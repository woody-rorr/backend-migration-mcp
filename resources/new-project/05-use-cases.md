# Use Cases — 비즈니스 로직 명세 템플릿

> service 레이어 메서드 본문은 이 문서의 표를 1:1로 옮긴 결과여야 한다.
> 즉, 여기서 빠진 항목은 코드에서도 빠진다 — **"빈칸 = 미구현"** 으로 간주.
> 도메인 엔티티는 `02-domain-model.md`, API 입출력은 `03-api-contract.md`, 트랜잭션 규약은 `04-data-layer.md §7`을 참조.

## 1. 식별자 / 네이밍

- 형식: `UC-<모듈약어>-<번호>: <동사구>`
  - 예: `UC-AUTH-01: 회원가입`, `UC-ORDER-03: 주문 취소`
- 번호는 모듈 내에서 순증가. 결번 허용 (삭제된 UC 자리는 비워둠).
- 한 UC = service 메서드 1개. 메서드명은 `<verb><Noun>` (예: `signUp`, `cancelOrder`).

## 2. 표준 섹션 (모든 UC 공통)

각 UC는 아래 8개 절을 **순서 그대로** 작성한다. 해당사항 없으면 `N/A`, 미정이면 `TBD`로 명시 (생략 금지).

### (1) API 매핑
| 항목 | 값 |
|---|---|
| Method/Path | `POST /auth/signup` |
| Auth | `Public` / `JWT` / `JWT + role:<role>` |
| Idempotent | yes / no (no면 멱등키 헤더 필요 여부 명시) |
| Rate limit | 기본(`06-runtime-rules.md`) 외 별도 정책 시만 명시 |

### (2) 입력 DTO
| 필드 | 타입 | 검증 | 비고 |
|---|---|---|---|
| email | string | `@IsEmail()` | unique 체크는 처리 단계에서 |
| password | string | `@MinLength(8)` | bcrypt 해시는 처리 단계 |

### (3) 사전조건 (Preconditions)
호출 진입 시점에 참이어야 하는 조건. 거짓이면 에러 케이스로 분기.
- [ ] `<리소스>` 가 존재
- [ ] 호출자가 `<리소스>` 의 owner
- [ ] `<엔티티>.status == 'active'`

### (4) 처리 단계 (Processing Steps) — **핵심**

> 이 표의 행 순서가 곧 service 메서드 본문 순서. LLM은 이 표를 그대로 코드로 옮긴다.

| # | 분류 | 동작 | 대상 / 호출 |
|---|---|---|---|
| 1 | validate | DTO 검증 (class-validator가 이미 처리한 것 외 비즈니스 검증) | 예: 비밀번호 정책 추가 검사 |
| 2 | load | 의존 리소스 조회 | `userRepo.findByEmail(email)` |
| 3 | authorize | 권한/소유권 체크 | `assertOwner(user, resource)` |
| 4 | mutate | 엔티티 상태 변경 (메모리상) | `order.cancel()` (불변식 검증 포함) |
| 5 | persist | DB 저장 | `orderRepo.save(order)` |
| 6 | emit | 이벤트/외부 호출 | `eventBus.emit('OrderCancelled', ...)` |

분류 의미:
- `validate` — 입력 자체의 정합성. DB 접근 없음.
- `load` — 읽기 전용 DB/캐시 조회.
- `authorize` — 권한 판단 (load 결과 기반).
- `mutate` — 엔티티 메서드 호출로 상태 전이. **불변식은 엔티티 메서드 안에서 assert**.
- `persist` — 쓰기. 트랜잭션 범위 안.
- `emit` — DB 트랜잭션 **밖**에서 실행 (이벤트, 외부 API).

### (5) 트랜잭션 경계
| 항목 | 값 |
|---|---|
| begin | step <번호> 직전 |
| commit | step <번호> 직후 |
| 외부 호출 위치 | step <번호> (트랜잭션 밖) |
| 격리 수준 | 기본(`READ COMMITTED`) / `REPEATABLE READ` / `SERIALIZABLE` |
| 비고 | 분산 트랜잭션 / Saga 필요 시 여기에 명시 |

규약은 `04-data-layer.md §7` 따름. 외부 호출은 항상 commit 이후.

### (6) 에러 케이스 (Error Cases) — **핵심**

> 이 표의 각 행 = `throw new <Exception>(...)` 한 번.
> 메시지/code는 `06-runtime-rules.md`의 에러 응답 포맷과 일관되게.

| 조건 | HTTP | code | message |
|---|---|---|---|
| email 중복 | 409 | `EMAIL_ALREADY_EXISTS` | `이미 등록된 이메일입니다` |
| 비밀번호 정책 위반 | 422 | `INVALID_PASSWORD` | `비밀번호 정책을 만족하지 않습니다` |
| 리소스 미존재 | 404 | `<RESOURCE>_NOT_FOUND` | `<리소스>를 찾을 수 없습니다` |
| 권한 없음 | 403 | `FORBIDDEN` | `권한이 없습니다` |
| 상태 충돌 | 409 | `INVALID_STATE` | `현재 상태에서 이 작업을 수행할 수 없습니다` |

검증 순서 권장: 인증(401) → 입력 검증(400/422) → 존재(404) → 권한(403) → 상태(409).

### (7) 사후조건 (Postconditions)
호출 성공 시 보장되는 상태. 테스트(`08-testing.md`)는 이 항목을 그대로 assertion으로 옮긴다.
- DB: `<table>.<col>` = `<value>`
- DB: 새 row 1개 추가 (`<table>`)
- 이벤트: `<EventName>` 1회 발행
- 외부: `<system>` 에 `<action>` 1회 호출

### (8) 응답 DTO
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | 생성된 리소스 ID |
| ... | ... | ... |

## 3. UC 추가 시 체크리스트
- [ ] 모듈 내 번호 순증가
- [ ] 8개 절 모두 채움 (`TBD` 명시 허용, 생략 금지)
- [ ] 처리 단계 표의 분류가 6가지 중 하나
- [ ] 에러 케이스 표가 비어있지 않음 (최소: 인증 실패 1행)
- [ ] 사후조건 표가 비어있지 않음
- [ ] `03-api-contract.md` 의 엔드포인트와 1:1 대응
- [ ] 트랜잭션 경계가 `04-data-layer.md §7` 규약과 충돌 없음

## 4. 빈 템플릿

새 UC를 추가할 때 아래 블록을 복제해서 채운다.

```markdown
## UC-<MOD>-<NN>: <동사구>

### API 매핑
| Method/Path | Auth | Idempotent | Rate limit |
|---|---|---|---|
| `<METHOD> /<path>` | <Public/JWT/...> | yes/no | 기본 |

### 입력 DTO
| 필드 | 타입 | 검증 | 비고 |
|---|---|---|---|

### 사전조건
- [ ]

### 처리 단계
| # | 분류 | 동작 | 대상 / 호출 |
|---|---|---|---|
| 1 | validate | | |
| 2 | load | | |
| 3 | authorize | | |
| 4 | mutate | | |
| 5 | persist | | |
| 6 | emit | | |

### 트랜잭션 경계
| begin | commit | 외부 호출 | 격리 수준 |
|---|---|---|---|
| step <N> 직전 | step <N> 직후 | step <N> | READ COMMITTED |

### 에러 케이스
| 조건 | HTTP | code | message |
|---|---|---|---|

### 사후조건
-

### 응답 DTO
| 필드 | 타입 | 설명 |
|---|---|---|
```

## 5. 미작성/TBD 처리
- 채우지 못한 절은 `TBD`로 표시 — `scaffold_new_project_api` 호출 시 LLM이 해당 분기를 비워두거나 명세 보완을 요청하는 응답을 낸다.
- TBD가 남은 UC는 prod 머지 금지 (PR 리뷰 차단 기준).
