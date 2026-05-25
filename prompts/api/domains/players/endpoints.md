# players 엔드포인트 명세

## POST /players/setPlayers

> 선수 정보 등록/갱신 (어드민/배치).

**Auth**: JWT 필수 (`verifyJWT`).

**Body** (`schema` — origin 그대로)
- 선수 정보 배열

**처리**: `PlayerCtrl.setPlayerInfo(body)`

**Response data**: `null` (성공 시 `IResult<null>`)
