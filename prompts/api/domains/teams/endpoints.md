# teams 엔드포인트 명세

## 1. POST /teams/setTeams

> 팀 정보 등록/갱신 (어드민/배치).

**Auth**: JWT 필수.

**Body** (`schema` — origin)
- 팀 정보 배열

**처리**: `TeamCtrl.setTeamInfo(body)`

**Response data**: `null`

---

## 2. POST /teams/getTeams

> 팀 정보 조회.

**Auth**: JWT 필수.

**Body** (`schemaGetTeams` — origin)
- 조회 조건 (league_id, slug 등)

**처리**: `TeamCtrl.getTeamInfo(body)`

**Response data** (`IResponseGetTeamsForLoL` — origin)
- 팀 배열 + 메타
