# Data Layer

## 1. DB 엔진 (확정)
- **Aurora PostgreSQL 16.4** (Serverless v2, MinACU=0.5, MaxACU=2)
- 클러스터 식별자: `mcp-test`
- 인스턴스: `mcp-test-instance-1` (`db.serverless`, 퍼블릭 ON, IAM 인증 OFF)
- Writer endpoint: `mcp-test.cluster-cwjiw4y08fiq.us-east-1.rds.amazonaws.com:5432`
- Reader endpoint: `mcp-test.cluster-ro-cwjiw4y08fiq.us-east-1.rds.amazonaws.com:5432`
- Database name: `backend`
- Master user: `postgres`
- VPC: ECS와 동일 (`vpc-0e4611af2c26c7223`)
- DB SG: `sg-06ccdbd93fac71d95` (5432 from 0.0.0.0/0 — 테스트용)
- 비번 SSM: `/backend-api-service/db-password` (SecureString)

## 2. ORM
- **TBD**: TypeORM / Prisma / Drizzle 택1
- 권장: TypeORM (NestJS 1급 통합) 또는 Prisma (DX 우수)
- 결정 후 본 문서 상단에 확정 명시.

## 3. 디렉토리 규약
```
src/database/
├── data-source.ts            # TypeORM 기준
├── migrations/               # 타임스탬프 prefix
└── seeds/                    # 옵션
```
- 마이그레이션 파일명: `<timestamp>-<verb>-<target>.ts` (예: `1716800000000-create-user-table.ts`)
- 절대 수동 SQL 변경 금지 → 항상 migration 파일로.

## 4. 스키마 / 네이밍 규약
- DB schema: `public` 단일 (도메인 분리는 테이블 prefix로).
- 테이블명: `snake_case`, 복수형 (`users`, `orders`).
- 컬럼명: `snake_case`. ORM 매핑에서 camelCase로 변환.
- 외래키: `<referenced_table_singular>_id` (예: `user_id`).
- 인덱스: `idx_<table>_<col1>_<col2>`.
- unique: `uq_<table>_<col>`.

## 5. 공통 컬럼
모든 테이블 필수:
| 컬럼 | 타입 | 기본 | 비고 |
|---|---|---|---|
| id | uuid | gen | PK, uuid v7 |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | ORM 자동 갱신 |
| deleted_at | timestamptz | null | soft delete 채택 시 |

## 6. 테이블 명세
> 엔티티(`02-domain-model.md`)와 1:1.

### `<table_name>` (TBD)
| 컬럼 | 타입 | NOT NULL | 기본 | 인덱스 | 설명 |
|---|---|---|---|---|---|
| id | uuid | Y | gen | PK | |
| ... | ... | ... | ... | ... | ... |

**제약**
- `uq_<table>_<col>`: `(col)` unique
- `fk_<table>_<ref>`: `<col>` → `<ref_table>(id)` ON DELETE TBD

## 7. 트랜잭션 정책
- 서비스 메서드 단위에서 `@Transactional()` 또는 `dataSource.transaction(...)`.
- repository 직접 호출하는 곳에서는 트랜잭션 시작 금지.
- 외부 API 호출은 트랜잭션 바깥에서 (lock 점유 시간 최소화).

## 8. 커넥션 풀
- 기본 pool size: 10 (ECS task 1대 기준).
- 실제 운영 트래픽 측정 후 조정.

## 9. 마이그레이션 실행 정책
- ECS 컨테이너 entrypoint에서 `migration:run` 자동 실행 (옵션 — `07-env-and-secrets.md`의 `RUN_MIGRATIONS=true`).
- 또는 별도 one-off task로 분리 (안전한 방식, 권장).
