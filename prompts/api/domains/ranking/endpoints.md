# ranking 엔드포인트 명세

전체 JWT 필수.

## 1. GET /ranking/monthly/available-periods

> 랭킹 데이터가 있는 월 목록.

**Query**: 없음.

**처리**: `RankingCtrl.getAvailableRankingPeriods()`

**Response data**: `{ periods: string[] }` 또는 `string[]` (origin DTO 그대로). 각 항목 `YYYY-MM`.

---

## 2. GET /ranking/monthly

> 월별 랭킹 페이지.

**Query**
| 키 | 타입 | 필수 | 기본 |
|---|---|---|---|
| period_value | YYYY-MM | no | (서비스 기본: 가장 최근 월) |
| page | int | no | 1 |
| limit | int | no | 10 |

**검증**
- `page` NaN 또는 < 1 → `validationError "page must be >= 1"`
- `limit` NaN 또는 < 1 또는 > 500 → `validationError "limit must be between 1 and 500"`

**처리**: `RankingCtrl.getMonthlyRanking({ period_value, page, limit, current_userid: req.user.id })`

**Response data** (origin DTO)
- 랭킹 배열 (rank, userid, displayname, picture, win_streak 등) + 본인 랭킹 highlight

---

## 3. GET /ranking/monthly/user
## 3'. GET /ranking/monthly/user/:userid

> 특정 사용자(또는 본인) 랭킹 상세.

**Path params**
- `userid` (optional) — 없으면 JWT의 userid 사용

**검증**
- 둘 다 없음 → `validationError "userid is required (path or JWT)"`

**Query**
- `period_value` (optional)

**처리**: `RankingCtrl.getMonthlyRankingUserDetail(userid, period_value)`
