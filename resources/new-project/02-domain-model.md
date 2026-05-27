# Domain Model

> 코드 생성 전에 **엔티티와 불변식**을 여기서 먼저 확정합니다.
> ORM 엔티티 클래스는 이 문서를 그대로 옮기는 수준이어야 합니다.

## 1. 엔티티 목록
<!-- 추가 시 표 갱신 -->
| 엔티티 | 책임 | 주요 식별자 |
|---|---|---|
| TBD | TBD | TBD |

## 2. 엔티티 상세 템플릿
> 엔티티마다 아래 블록을 복제해 채웁니다.

### `<EntityName>`
**역할**: <한 문장>

**필드**
| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| id | uuid | Y | gen | PK |
| createdAt | timestamptz | Y | now() | |
| updatedAt | timestamptz | Y | now() | |

**관계**
- `<Other>` 1:N — FK `<other>Id`

**불변식 (Invariants)**
- TBD (예: `status`가 `closed`인 row는 변경 불가)

**상태머신** (해당 시)
```
draft → published → archived
```

**비즈니스 규칙**
- TBD

## 3. 공통 규약
- PK: `uuid v7` (시간 정렬 가능). 명세상은 `uuid` 표기.
- timestamps: `createdAt`, `updatedAt` 모든 테이블 필수. 소프트 삭제 시 `deletedAt`.
- soft delete 사용 여부: **TBD** (사용 시 모든 쿼리에서 `deletedAt IS NULL` 자동 적용).
- 금액/수량: `numeric(precision, scale)` — `float` 금지.
- enum: DB 레벨 enum 대신 string + check constraint (확장성).
