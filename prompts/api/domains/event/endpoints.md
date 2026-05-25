# event 엔드포인트 명세

## GET /event

> AI 게임 이벤트 페이지 조회.

**Auth**: JWT 필수.

**Query**
| 키 | 타입 | 필수 | 기본 |
|---|---|---|---|
| match_id (alias `matchId`) | string | **yes** | — |
| game_id (alias `gameId`) | string | no | — |
| page | int | no | 1 |
| per_page (alias `page_size`) | int | no | 20 (max 100) |

**검증**
- `match_id` 빈문자 → `validationError "match_id is required"` + `data: { events: [], total: 0, page: 1, per_page: 20 }`
- `page`/`per_page` NaN → 각각 기본값 (1, 20)

**처리**
- `EventCtrl.getEvents(matchId, gameId, page, perPage)` 호출
- 정렬: `created_date DESC` (최신 먼저)

**Response data**
```ts
{
  events: AiGameEvent[],
  total: number,
  page: number,
  per_page: number
}
```

`AiGameEvent`: origin `Event.Interface`의 DTO 그대로.
