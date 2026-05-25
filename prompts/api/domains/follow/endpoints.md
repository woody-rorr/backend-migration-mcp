# follow 엔드포인트 명세 (재현 스펙)

전부 JWT 필수. `userid = req.user.id`. 응답은 `{ resultCode, resultMsg, data }`.

---

## 1. GET /follow/my

> 내가 팔로우 중인 항목을 타입별 그룹으로 반환.

**Query**
| 키 | 타입 | 필수 | 설명 |
|---|---|---|---|
| follow_type | `league`\|`team`\|`player` | no | 미지정 시 3종 전부 반환 |

**Response data (follow_type 미지정)**
```json
{
  "follow_onboarding_yn": true,
  "leagues": [MyFollowItem, ...],
  "teams":   [MyFollowItem, ...],
  "players": [MyFollowItem, ...]
}
```

**Response data (follow_type 지정)**
- `league`: `{ follow_onboarding_yn, leagues: [...] }`
- `team`:   `{ follow_onboarding_yn, teams: [...] }`
- `player`: `{ follow_onboarding_yn, players: [...] }`

**MyFollowItem (공통)**
```ts
{
  idx: number,                  // follow.idx
  target_id: string,
  display_order: string,        // 문자열! (원본 호환)
  created_date: Date,
  updated_date: Date,
  follow_yn: true,              // 항상 true (내 팔로우니까)
  name?: string,                // league/team/player 이름 (player는 fullName||nickname)
  slug?: string,
  image_url?: string,
  boostYN: 'Y' | 'N',
  first_name: string|null,      // player만 채움, 나머지는 null
  last_name:  string|null,
  fullName:   string|null,      // first+' '+last
  nickname:   string|null
}
```

**정렬**: `display_order ASC, created_date ASC`.

**`follow_onboarding_yn`**: `users.follow_onboarding_yn === 1` 인지 boolean.

---

## 2. GET /follow/list

> "팔로우 항목 먼저, 그 뒤에 비팔로우 항목" 합쳐서 페이지로 반환.

**Query**
| 키 | 타입 | 필수 | 기본 | 설명 |
|---|---|---|---|---|
| follow_type | `league`\|`team`\|`player` | no | `team` | 잘못된 값이면 `team`으로 정정 |
| limit | int | no | (전체) | 1~200. 누락/`""` 시 페이징 안 함 |
| offset | int | no | 0 | <0 이면 0 |

**Response data**
- `follow_type=league`: `{ leagues: ListItem[], total, limit, offset }`
- `follow_type=team`:   `{ teams: ListItem[], total, limit, offset }`
- `follow_type=player`: `{ players: ListItem[], total, limit, offset }`

`total` = 해당 타입의 **전체 가능 항목 수**(팔로우+비팔로우 모두 포함).
- league: `leagues WHERE use_YN='Y'` 의 count
- team: `teams` count
- player: `SELECT COUNT(DISTINCT id) FROM players`

`limit`: 요청 limit이 없으면 응답에서 `total` 반환. 있으면 요청값(1~200 clamp).

**ListItem**
```ts
{
  idx: number,                  // 팔로우이면 follow.idx, 아니면 0
  target_id: string,
  name: string|null,
  slug: string|null,
  image_url: string|null,
  initial: string|null,         // team만 의미 있음
  boostYN: 'Y' | 'N',
  team_id: string|null,         // player만
  team_name: string|null,       // player만
  team_image_url: string|null,  // player만
  first_name: string|null,      // player만
  last_name:  string|null,
  fullName:   string|null,
  nickname:   string|null,
  created_date: Date|null,      // 팔로우면 follow.created_date, 아니면 null
  updated_date: Date|null,
  display_order: number|null,
  follow_yn: boolean            // 이 항목을 사용자가 팔로우 중인지
}
```

**페이지 구성 알고리즘** (`business-rules.md` R3 핵심):

```
followedIds = follow 테이블에서 (userid, follow_type) 조건으로 display_order ASC 정렬한 target_id 목록
followedCount = followedIds.length
total = (해당 타입 전체 count)
lim = limit ?? total
off = offset

if off >= followedCount:
    // 팔로우 구간을 다 넘어감 → 비팔로우만
    skip = off - followedCount
    take = min(lim, total - off)
    items = fetchUnfollowed(skip, take)
else:
    followSliceLen = min(lim, followedCount - off)
    followSlice = followedItems[off : off+followSliceLen]
    remaining = lim - followSlice.length
    unfollowed = remaining>0 ? fetchUnfollowed(0, remaining) : []
    items = followSlice + unfollowed
```

`fetchUnfollowed(skip, take)`:
- **league**: `SELECT id,name,slug,image_url,boostYN FROM leagues WHERE use_YN='Y' AND id NOT IN (...followedIds) ORDER BY boostYN DESC, id ASC LIMIT ? OFFSET ?`
- **team**: `SELECT id,name,slug,image_url,boostYN,initial FROM teams WHERE id NOT IN (...followedIds) ORDER BY boostYN DESC, id ASC LIMIT ? OFFSET ?`
- **player**: 원시 SQL — `business-rules.md` R6의 ROW_NUMBER 쿼리 그대로.

`followedItems` 구성:
- league/team: `WHERE id IN (...followedIds)` 로 한 번에 조회 후 `followedIds` 순서대로 재정렬.
- player: 동일하게 IN 조회 후 R6 dedupe → followedIds 순서.

---

## 3. GET /follow/list/teams

> `GET /follow/list?follow_type=team` 의 alias. 응답 동일.

**Query**: `limit`, `offset` (위와 동일 규칙)

---

## 4. PUT /follow  (단일 타입 일괄)

> 한 타입(`league`/`team`/`player`)의 팔로우 집합을 **요청 배열 그대로 set**.
> 요청에 없는 기존 항목은 같은 트랜잭션에서 **삭제**.

**Query** (둘 중 하나로 follow_type 전달)
| 키 | 타입 |
|---|---|
| follow_type | `league`\|`team`\|`player` |

**Body**
```json
{
  "follow_type": "team",          // query에 없으면 body로
  "follow": [
    { "target_id": "T1" },
    { "target_id": "T2" }
  ]
}
```

**검증 (순서대로)**:
1. body가 object 아님 → `validationError "Request body is required"`
2. `follow`가 배열 아님 → `validationError "follow array is required"`
3. `follow[i].target_id`가 string 아님 → `validationError "follow[i].target_id is required (string)"`
4. `follow_type`이 있는데 invalid → `validationError "follow_type must be league, team, or player"`
5. query/body 어디에도 follow_type 없음 → `validationError "follow_type is required (query or body)"`

**처리** (트랜잭션)
- 입력 `items[i]`에 대해 `display_order = i+1` 부여
- 각 항목:
  - 기존 follow 존재 → `UPDATE follow SET display_order=?, updated_date=NOW() WHERE userid AND follow_type AND target_id`. 결과 `action='updated'`.
  - 미존재 → `INSERT INTO follow (userid, follow_type, target_id, display_order, created_date, updated_date) VALUES (?, ?, ?, ?, NOW(), NOW())`. 결과 `action='created'`.
- 트랜잭션 끝에 `(userid, follow_type)` 기존 follow 중 요청 target_id에 없는 것 모두 DELETE.

**Response data**
```json
{
  "success": true,
  "message": "팔로우가 처리되었습니다.",
  "follow_type": "team",
  "total": 2,
  "created": 1,
  "updated": 1,
  "deleted": 3,
  "results": [
    { "target_id": "T1", "action": "created"|"updated", "idx": 123, "display_order": 1 },
    ...
  ]
}
```

---

## 5. PUT /follow  (batch — DONE 시 1회 호출)

> 라우터 매핑은 4번과 **동일 path** (`PUT /follow`). 본문에 `league`/`team`/`player` 키 중 하나 이상 있으면 batch로 동작.
>
> 현 origin index.ts는 `putFollows`를 batch handler(`putFollowsBatchHandler`)에 매핑함 → **마이그레이션에서는 batch가 표준**. 단일-타입 PUT은 폐기 후보.

**Body**
```json
{
  "league": [ { "target_id": "L1" }, { "target_id": "L2" } ],   // optional
  "team":   [ { "target_id": "T1" } ],                          // optional
  "player": [ { "target_id": "P1" } ]                           // optional
}
```

**개수 제한 (하드코딩)**:
- league ≤ 3
- team ≤ 6
- player ≤ 12
- 초과 시 `validationError "리그는 최대 3개까지 선택 가능합니다."` 형식 메시지

**처리** (단일 트랜잭션)
- `league`/`team`/`player` 키가 있는 것마다 § 4의 알고리즘을 그 타입으로 실행
- 마지막에 `UPDATE users SET follow_onboarding_yn=1 WHERE userid=?`

**Response data**
```json
{
  "success": true,
  "message": "팔로우가 저장되었습니다.",
  "follow_onboarding_yn": true,
  "league": { ... § 4 응답 구조 ... },   // 요청에 있을 때만 포함
  "team":   { ... },
  "player": { ... }
}
```

---

## 6. DELETE /follow/:followType/:targetId

**Path params**
- `followType`: `league`|`team`|`player`
- `targetId`: string

**검증**
- 둘 중 하나 없으면 `validationError "followType, targetId are required"`

**처리**
1. `(userid, follow_type, target_id)`로 follow 조회 → 없으면 `Error('팔로우한 항목을 찾을 수 없습니다.')` → resultCode `FollowNotExists`
2. 삭제
3. 같은 `(userid, follow_type)` 잔존 row들의 `display_order`를 1,2,3,... 으로 재정렬

**Response data**
```json
{ "success": true, "message": "팔로우가 삭제되었습니다." }
```

---

## Swagger JSDoc 의무

각 라우트 위에 `@swagger` 블록 필수 (`prompts/convert_handler.md` § 파일 출력 규약 참조). 위 응답 스키마를 `components.schemas`로 두고 `$ref`해도 됨.
