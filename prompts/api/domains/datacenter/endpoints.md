# datacenter 엔드포인트 명세

전체 **JWT 미적용** (origin 그대로). 외부 보호 의무 — ALB rule / IP 화이트리스트로 어드민/배치 호출만 허용.

전부 POST + JSON schema (origin 그대로 zod 이식).

| 엔드포인트 | controller 함수 | schema | 비고 |
|---|---|---|---|
| POST /datacenter/setLeaguesSchedulesOfLoL | `DatacenterCtrl.setLeaguesSchedulesOfLoL` | `schemaSetLeaguesSchedulesOfLoL` | 리그 upsert |
| POST /datacenter/setSeriesSchedulesOfLoL | `setSeriesSchedulesOfLoL` | `schemaSetSeriesSchedulesOfLoL` | 시리즈 upsert |
| POST /datacenter/setTournamentsSchedulesOfLoL | `setTournamentsSchedulesOfLoL` | `schemaSetTournamentsSchedulesOfLoL` | 토너먼트 upsert |
| POST /datacenter/setMatchesSchedulesOfLoL | `setMatchesSchedulesOfLoL` | `schemaSetMatchesSchedulesOfLoL` | 매치 upsert |
| POST /datacenter/setUpdateMatcheInfo | `setUpdateMatcheInfo` | `schemaSetUpdateMatchesInfo` | 매치 결과/상태 갱신 |
| POST /datacenter/setTeamsOfLoL | `setTeamsOfLoL` | `schemaSetTeamsOfLoL` | 팀 upsert |
| POST /datacenter/setPlayersOfLoL | `setPlayersOfLoL` | `schemaSetPlayersOfLoL` | 선수 upsert |

**처리 패턴 (공통)**:
```js
const ret = await DatacenterCtrl.<fn>(body);
res.json(ret.getResult());
```

**Response data**: 성공 시 `null` (`IResult<null>`).

## 주의 (path 오타)

- `setUpdateMatcheInfo` — "Matche" (e 누락 아님, 원본 그대로). 마이그레이션도 동일 path 유지.
