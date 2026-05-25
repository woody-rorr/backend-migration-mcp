# follow 도메인 개요 (재현 스펙)

> 본 .md 3종(`overview.md` + `endpoints.md` + `business-rules.md`)만 보고 `src/domains/follow/` 전체를 다시 만들어도 **API 계약과 동작이 동일**해야 합니다. 코드/스키마/예시 누락 시 본 파일을 갱신하세요.

## 책임

사용자가 e스포츠 엔티티(리그/팀/선수)를 팔로우하고, 팔로우 목록을 우선 노출하는 추천 리스트를 받는 도메인.

## 엔티티 (기존 DB — 변경 금지)

테이블 자체는 손대지 않습니다. 핸들러가 사용하는 컬럼만 명시:

### `follow`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| idx | bigint pk | auto increment |
| userid | string | JWT의 user.id |
| follow_type | enum('league','team','player') | |
| target_id | string | league/team/player의 id |
| display_order | int | 1-base, 같은 (userid, follow_type) 내 연속 |
| created_date | datetime | |
| updated_date | datetime | |

unique 키: `(userid, follow_type, target_id)`

### `users`
| 컬럼 | 비고 |
|---|---|
| userid | string pk |
| follow_onboarding_yn | tinyint(1) — 0/1 |

### `leagues`
| 컬럼 | 비고 |
|---|---|
| id, name, slug, image_url, boostYN ('Y'/'N'), use_YN ('Y'/'N') |

### `teams`
| 컬럼 |
|---|
| id, name, slug, image_url, boostYN, initial, created_date |

### `players`
| 컬럼 |
|---|
| id, slug, first_name, last_name, nickname, image_url, team_id, boostYN, created_date |

> `players`는 동일 `id`가 여러 행으로 존재할 수 있음(같은 선수의 팀 이력) → 중복 처리 룰은 `business-rules.md` R6 참조.

## 라우팅 베이스

`app.use('/follow', followRouter)` — 모든 엔드포인트 `/follow` 하위.

## 공통 동작

- 인증: 전 엔드포인트 **JWT 필수**. `req.user.id`가 `userid`. 없으면 즉시 `validationError`.
- 응답 포맷: `{ resultCode, resultMsg, data }` (`_shared/response-format.md`의 `ok/fail` 사용)
- 정렬/페이징 규약: `business-rules.md` R3, R4
- 트랜잭션 경계: PUT 계열만 트랜잭션 (`putFollowsForType` 단위)

## 다른 도메인 의존

- `users.follow_onboarding_yn` — batch PUT 시 1로 업데이트 (이 도메인이 직접 update)
- `leagues`/`teams`/`players` — read-only 조회만. 직접 update 금지.
