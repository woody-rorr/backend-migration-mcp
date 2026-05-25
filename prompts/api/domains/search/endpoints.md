# search 엔드포인트 명세

## GET /search

> 통합 검색 (리그+팀+선수).

**Auth**: 없음 (공개).

**Query**
| 키 | 타입 | 필수 | 비고 |
|---|---|---|---|
| q | string | no | 검색어. trim 후 빈문자 → undefined |
| searchType | `league` \| `team` \| `player` | no | 미지정/잘못된 값 → 전체 검색 |

**처리**: `SearchCtrl.search(q, searchType)`
- `searchType` 정규화: `trim().toLowerCase()` 후 화이트리스트 매칭 → 그 외는 undefined
- undefined면 리그+팀+선수 전부 검색

**Response data** (origin DTO)
```ts
{
  leagues?: [{ id, name, slug, image_url, boostYN }],
  teams?: [{ id, name, slug, image_url, boostYN, initial }],
  players?: [{ id, fullName, nickname, slug, image_url, boostYN, team_id, team_name }]
}
```

타입별 검색이면 해당 키만, 전체면 셋 다.
