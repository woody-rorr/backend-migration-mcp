# spark 도메인 비즈니스 규칙 (결정론)

## R1. spark = user_balance.exp (절대)

- 응답 필드 `exp`가 곧 사용자가 보유한 spark.
- `users` 테이블은 spark 잔액에 사용하지 않음. `user_balance.exp`만이 진실의 출처.
- 누적 지급/회수는 `spark_user_transactions` 이력으로 추적.

## R2. 멱등성 키

| 보상 종류 | source_type | source_id |
|---|---|---|
| 퀴즈 참여 (라이브) | `quiz_answer` | `<match_id>\|<game_id>` |
| 퀴즈 참여 (스케줄) | `quiz_answer` | `<match_id>\|schedule` |
| 로그인 보상 | `login_daily` | `<YYYY-MM-DD KST>` |
| 부스트 (pre_match) | `boost_pre_match` | `<match_id>` |
| 부스트 (live_match) | `boost_live_match` | `<match_id>\|<game_id>` |
| 월별 랭킹 | `monthly_ranking_reward` | `<period_value>\|rank{N}\|<userid>` |

기존 행 존재 시 추가 지급 금지 (`throw new Error('User X already received reward for ...')`).

## R3. 회수 (revoke) 정책

`revokeQuizAnswerSpark`:
- 동일 `source_type='quiz_answer'`, `source_id`로 검색
- 없으면 `(matchId 단독)` 구버전 source_id로도 검색 (하위호환)
- 찾으면:
  - `user_balance.exp = exp - <earn.exp>` (음수 가능 — origin 그대로)
  - 해당 earn row를 **DELETE** (spend 기록 안 남김 — origin 그대로)
- 응답: `{ revoked: boolean, exp_revoked: number }`

마이그레이션 시 이 동작 그대로. "spend 트랜잭션 남기는 게 좋지 않나?"는 후속 결정이 있을 때까지 변경 금지.

## R4. user_balance INSERT 컬럼 순서

origin SQL을 그대로 사용:

```sql
INSERT INTO user_balance (userid, point, cash, exp, InsertDate)
VALUES (?, 0, 0, ?, ?)
```

- `point` / `cash` 초기값 0
- `InsertDate` (대문자 D — 원본 그대로). UPDATE 시는 `UpdateDate` (대문자 D).

## R5. spark_user_transactions INSERT 컬럼

```sql
INSERT INTO spark_user_transactions
  (userid, transaction_type, exp, source_type, source_id, description, metadata, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

- `transaction_type`: `'earn'` (지급) — `'revoke'`/`'spend'`는 origin에서 사용 안 함
- `metadata`: `null` 또는 `JSON.stringify(obj)` 문자열 (DB가 JSON 컬럼이어도 stringify)
- `insertId` 추출: `mysqlInsertId(result)` — `Array.isArray(result) ? result[0].insertId : result.insertId`

## R6. 트랜잭션 경계

지급/회수 작업은 항상 `ds.transaction(async manager => ...)` 안에서. 단일 쿼리만 있는 경우라도 future-proof로 트랜잭션 유지 (origin 그대로).

트랜잭션 안에서 외부 호출 (MSGBoxes 등) 금지 — pool 점유.

## R7. 등급 산출

`src/domains/spark/constants/grade.config.{js,ts}`의 두 함수를 그대로 사용:

- `getGradeByExp(exp): number`
- `getGradeNameByExp(exp): string`

origin 파일을 1:1 이식. 등급 임계값/이름 변경 금지.

## R8. MSGBoxes 의존 실패 처리

`MSGBoxesServices.selectNewMessageCount`는 별도 DB 연결을 사용 — 마이그레이션 시:
- origin과 동일하게 try/catch로 감싸 실패 시 `msgCnt=0`
- profile 응답 자체는 정상 (200)

`MSGBoxes` 모듈이 마이그레이션 레포에 아직 없다면 stub 동봉 (항상 `[[{ newMsgCnt: 0 }]]` 반환). PR description에 TODO 명시.

## R9. picture 우선순위

`getProfile` 응답의 `picture`:

```
JWT의 event.user.picture (있으면)
  → users.picture (있으면)
  → null
```

JWT picture는 구글 OAuth가 매 로그인마다 신선한 값 제공 → 항상 우선.

## R10. resultCode 매핑

- 성공: `Success`
- 검증 실패: `validationError`
- 사용자/항목 미존재 + 중복 지급 + 기타: `error.message` 그대로 + `resultCode.error`
- origin은 별도 비즈니스 코드 사용 안 함 (`SparkAlreadyRewarded` 같은 enum 없음). 마이그레이션도 동일하게 유지.

## R11. quiz-participation의 userid 처리

- body의 `userid`/`userId`는 **무시**
- 항상 JWT의 `event.user.id` 사용
- body는 `match_id`/`game_id`만 정규화 (alias `matchId`, `problem_id`, `problemId` 허용)

이는 권한 우회 방지 — 다른 사용자 ID로 보상 지급 차단.

## R12. transactions 응답 metadata 타입

- DB가 JSON 컬럼이면 ORM이 객체로 반환 → 응답도 객체
- 문자열 컬럼이면 문자열 반환 → 응답도 문자열
- origin에서 별도 파싱 없음 (`t.metadata ?? null`). 마이그레이션도 그대로.

## R13. period_value 형식

월별 보상의 `period_value`는 `YYYY-MM`. 일자 단위 보상의 `source_id`는 `YYYY-MM-DD KST`. 둘은 다른 키 공간.

`period_value` 정규식 검증은 origin에 없음. 잘못된 포맷은 service 내부에서 결과 0건으로 처리. 마이그레이션도 그대로 (별도 검증 추가 금지).

## R14. 내부 호출 전용 API (라우트 없음)

다음은 controller에 있지만 HTTP 라우트로 노출 안 함. 마이그레이션 시 service 함수로만 export하고 `routes.js`에 mount 금지:

- `earnSpark` (controller 보유, route 주석 처리됨)
- `revokeQuizAnswerSpark` (Quiz 서비스가 호출)
- `grantSparkOnBoost` (Donation 컨트롤러가 호출)
- `grantSparkOnLogin` (Users 컨트롤러가 호출)
- `rewardRanking` (수동 rank reward — handler는 있으나 route 미정의)

`getBalance`, `getSummary`, `earnSpark`, `rewardRanking`, `rewardLogin` 핸들러는 모두 origin에서 라우트 없거나 `not implemented` 반환. 마이그레이션도 동일 유지 — 신규 라우트 추가 시 별도 PR + 본 .md 갱신.

## R15. 음수 잔액 허용

revoke 결과로 `user_balance.exp`가 음수가 될 수 있음 (origin 그대로 — 검사 없음). 마이그레이션도 동일. 음수 방지 정책은 별도 결정 시 추가.

## R16. 서비스 함수 이식 의무

다음 `Spark.Services.ts` 함수는 본문 1:1 이식:

- `getProfile(userid, pictureFromToken)`
- `getTransactions(userid, source_type, start_date, end_date, limit, offset)`
- `rewardQuizParticipation(userid, matchId, gameId)`
- `revokeQuizAnswerSpark(userid, matchId, gameId)`
- `processMonthlyRankingReward(period_value)`
- `grantSparkInternal(manager, userid, exp, source_type, source_id, description, metadata, checkDuplicate)` (private)
- `quizAnswerSparkSourceId(matchId, gameId)` (export)
- `mysqlInsertId(result)` (private util)

HTTP 핸들러는 본 .md 그대로, 서비스 내부 알고리즘은 원본을 옮긴다.
