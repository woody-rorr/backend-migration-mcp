# follow 도메인 비즈니스 규칙 (결정론)

번호 규칙은 변경 금지. 신규 룰은 R-next 추가.

## R1. follow_type 정규화

문자열 입력은 `trim().toLowerCase()` 후 `['league','team','player']` 중 하나여야 함.

- **GET /follow/list**: 잘못된 값 → 기본값 `'team'` 으로 **자동 정정** (에러 아님)
- **PUT /follow**: 잘못된 값 → `validationError` (정정하지 않음)
- **DELETE**: path param 그대로 신뢰 (검증 없음 — 단 service에서 미존재 follow면 NotExists로 응답)

## R2. 인증/사용자 ID

- 모든 엔드포인트 `verifyJWT` 통과
- `userid = event.user?.id` (마이그레이션 후 = `req.user.id` 또는 `req.user.sub`)
- 누락 시 즉시 `validationError "userid is required"` 반환 (DB 접근 전)

## R3. /follow/list 페이지 구성 (절대 규칙)

"내 팔로우 항목을 항상 앞에, 그 뒤에 비팔로우" — 다른 페이지에서 팔로우해도 첫 페이지로 올라오게.

- 정렬 기준:
  - 팔로우 항목: `follow.display_order ASC` (사용자가 정한 순서)
  - 비팔로우 항목: `boostYN DESC, id ASC` (boost가 있는 항목 우선, 그 다음 id)
- 페이지 계산 알고리즘은 `endpoints.md` § 2 의사코드 그대로 구현. **재현 시 그 알고리즘에서 한 줄도 변형 금지.**

## R4. limit / offset 규칙

`parseLimitOffset` 동작 (원본 코드 그대로):

```
hasLimit = q.limit != null && q.limit !== ''
limit = hasLimit ? parseInt(q.limit) : undefined
offset = q.offset != null && q.offset !== '' ? parseInt(q.offset) : 0

limit = (hasLimit && !NaN && limit>0) ? min(limit, 200) : undefined
offset = NaN ? 0 : max(offset, 0)
```

- `limit` 미지정 = 페이징 안 함 (전체 반환)
- `limit` 최대 200 (200 초과는 200으로 clamp)
- `offset` 음수는 0

## R5. PUT 멱등성 + 순서 보존

- PUT은 "set" 의미: 들어온 배열 그대로 상태 동기화
- 같은 PUT을 두 번 호출해도 결과 동일 (idempotent)
- `display_order`는 요청 배열 순서대로 `i+1` 부여
- UPDATE/INSERT는 ORM이 아닌 **raw SQL** 사용 (원본 주석: `em.insert(Follow, ...)`는 `Cannot update entity because entity id is not set` 에러 발생) — 마이그레이션 후에도 `pool.query`로 직접 작성

## R6. player 중복 행 처리

`players` 테이블에 같은 `id`가 여러 행으로 존재 가능 (선수의 팀 이력). 비팔로우 페이지 쿼리는 다음 결정적 우선순위로 1행만 선택:

1. `players.created_date` ASC (더 이른 것)
2. 동률이면 `teams.created_date` ASC (해당 행의 team의 created_date)
3. 동률이면 `team_id` ASC (string compare)

**SQL (마이그레이션 시 그대로 사용)**:

```sql
SELECT z.id AS id, z.boostYN AS boostYN FROM (
  SELECT p.id, p.boostYN,
    ROW_NUMBER() OVER (
      PARTITION BY p.id
      ORDER BY p.created_date ASC,
               t.created_date ASC,
               p.team_id ASC
    ) AS rn
  FROM players p
  LEFT JOIN teams t ON t.id = p.team_id
  WHERE p.id NOT IN (?, ?, ...)   -- followedIds (없으면 WHERE 생략)
) z
WHERE z.rn = 1
ORDER BY z.boostYN DESC, z.id ASC
LIMIT ? OFFSET ?
```

ROW_NUMBER가 지원 안 되는 DB로 갈 가능성 대비 fallback (GROUP BY + MAX(boostYN)) 도 원본 코드대로 유지. (재현 시 try/catch 그대로)

팔로우된 player 항목도 동일한 dedupe 규칙으로 1행 선택해야 함 (`pickPreferredPlayerRows`).

## R7. boost 우선 정렬

- 비팔로우 정렬에서 `boostYN='Y'`인 항목을 먼저 노출
- league, team, player 공통

## R8. boostYN 값 정규화

DB에서 가져온 `boostYN`이 정확히 `'Y'`이면 `'Y'`, 그 외(`null`, `'N'`, `''`, undefined 등)는 `'N'`으로 정규화 후 응답.

## R9. player 이름 표시

- `fullName` = `[first_name, last_name].filter(Boolean).join(' ').trim()` (비면 `null`)
- `name` = `fullName || nickname` (둘 다 없으면 응답 필드 omit)

## R10. team_name / team_image_url (player만)

player 항목 응답 시:
- `players.team_id`로 `teams`를 한 번에 batch 조회 (N+1 금지)
- 매핑 못 찾으면 `null`
- 응답 필드: `team_id`, `team_name`, `team_image_url`

## R11. PUT 트랜잭션 단위

- 단일 타입 PUT: `followRepo.manager.transaction` 한 번
- batch PUT: 모든 타입 + `users.follow_onboarding_yn=1` 전부 한 트랜잭션
- 트랜잭션 중 외부 호출 금지 (DB pool 점유)

## R12. batch 개수 제한 (하드코딩)

| 타입 | 최대 |
|---|---|
| league | 3 |
| team | 6 |
| player | 12 |

초과 시 `validationError "리그는 최대 3개까지 선택 가능합니다."` 식 한국어 메시지. 정확한 메시지 문구는 `endpoints.md` § 5 의 문자열 그대로.

## R13. DELETE 후 display_order 재정렬

삭제된 follow와 같은 `(userid, follow_type)`의 잔존 행들을 `display_order ASC`로 가져와 1,2,3,... 으로 갱신. 이미 맞으면 skip. 한 UPDATE 쿼리당 1행 (배치 update 안 함 — 원본 그대로).

## R14. resultCode 매핑

- 성공: `resultCode.Success` + `"Success"`
- 검증 실패: `resultCode.validationError`
- DELETE 미존재: 에러 메시지에 `'찾을 수 없습니다'` 포함 → `resultCode.FollowNotExists`
- 기타 예외: `resultCode.error` + `error.message`

`src/common/resultCode.js` (마이그레이션 측)에 `Success`, `error`, `validationError`, `FollowNotExists` enum 노출 보장.

## R15. 응답 메시지 한국어 고정

다음 문자열은 변경 금지 (클라이언트가 키로 사용할 가능성):

- `"팔로우가 처리되었습니다."` (PUT 단일)
- `"팔로우가 저장되었습니다."` (PUT batch)
- `"팔로우가 삭제되었습니다."` (DELETE)
- `"팔로우한 항목을 찾을 수 없습니다."` (DELETE 미존재 에러)

## R16. follow_onboarding_yn 갱신 시점

`PUT /follow` batch 시 **항상** `users.follow_onboarding_yn = 1`로 set. (값이 이미 1이어도 동일 UPDATE 호출 — 원본 그대로)

단일 타입 PUT에서는 갱신 **안 함**.

## R17. 정렬 안정성 (`getMyFollows`)

`follow` 조회 정렬: `display_order ASC, created_date ASC`. 같은 display_order가 있을 수 있으니 2차 키로 created_date.

## R18. 응답의 display_order 타입 차이

- `getMyFollows`의 MyFollowItem: `display_order: string` (Number→String 변환)
- 그 외(`getListWithFollow`, PUT 응답): `display_order: number`

원본 코드 그대로 — 변경 시 프론트가 깨질 수 있음.

## R19. 외부 의존성

이 도메인은 다음을 read-only로 직접 조회 (도메인 분리 위반 인지된 상태):
- `leagues`, `teams`, `players`, `users`

마이그레이션 시 그대로 유지. 추후 user/league/team/player 도메인이 분리되면 해당 service 경유로 리팩토링 — 본 룰셋 그대로 유지하되 R19를 갱신.
