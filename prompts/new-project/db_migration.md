# DB Migration — 작성 규약

> ORM은 `04-data-layer.md` §2 결정 (TBD인 경우 TypeORM 기본).
> 모든 스키마 변경은 마이그레이션 파일을 거친다 — 수동 SQL 금지.

## 1. 파일 위치 / 네이밍
- 디렉토리: `src/database/migrations/`
- 파일명: `<unix_ts_ms>-<verb>-<target>.ts`
  - 예: `1716800000000-create-users-table.ts`
  - verb: `create`, `add`, `drop`, `alter`, `rename`, `seed`
- class 이름: 파일명을 PascalCase로 (`CreateUsersTable1716800000000`).

### 1.0 cross-call 중복 방지 (Critical — 위반 시 부팅 실패)
`publish` scope에서 github_publish.md §2.0에 따라 target 레포의 `src/database/migrations/` 디렉토리를 fetch한 뒤 다음 처리:

1. **같은 테이블을 만드는 migration이 이미 존재하면 신규 파일을 drop** — 파일명에 동일 `<verb>-<target>` (예: `create-follows-table`) 패턴이 있는지 확인. 있으면 accumulated_files에서 제거하고 todo에 `"skipped duplicate migration: <기존파일명>"` 기록. (관측 사례: 2026-06-05 PR #64 — 같은 follows 테이블 생성 마이그 2개 → 두번째 실행 시 "table already exists" 에러)
2. **timestamp 단조 증가 보장** — 신규 migration timestamp가 기존 max보다 작거나 같으면 `max(existing) + 1` 로 rename. 파일명·클래스명 모두 업데이트.

### 1.1 한 호출에서 여러 migration 파일 생성 시 규칙 (Critical — 위반 시 migration 실패)
**같은 timestamp 절대 금지**. 한 scaffold 호출에서 N개 migration 파일을 동시 생성할 때는:

1. **단조 증가 timestamp 필수** — 첫 파일 `1716800000000`, 두 번째 `1716800000001`, 세 번째 `1716800000002`, ... 으로 millisecond +1씩 증가.
2. **FK 의존 순서대로 timestamp 배치** — A 테이블이 B 테이블을 FK로 참조하면, B의 timestamp가 A보다 **작아야** 함. TypeORM은 timestamp 순으로 실행하므로 의존 대상이 먼저 생성돼야 함.
3. **파일명 + 클래스명 둘 다 동일 timestamp** 사용 (예: `1716800000001-create-events-table.ts` 안 클래스명도 `CreateEventsTable1716800000001`).

**관측 사례 (2026-06-02 PR #30 calendar)**: calendars와 events 둘 다 `1780358400000`로 동일 timestamp → events가 먼저 실행 시도 → calendars 미존재 FK 에러 → migration 전체 실패 → 두 테이블 다 생성 안 됨.

**올바른 예** (calendars → events 관계):
```
1780358400000-create-calendars-table.ts   (FK 없음, 먼저)
1780358400001-create-events-table.ts      (calendars FK 참조, 나중)
```

**잘못된 예** (위 PR #30 사례):
```
1780358400000-create-calendars-table.ts
1780358400000-create-events-table.ts      ← 같은 timestamp! 실행 순서 비결정적
```

### 1.2 다중 migration 생성 시 응답 의무
한 scaffold 호출에서 migration 2개 이상 생성한 경우, 응답 JSON에 **의존 관계 명시**:
```json
{
  "files": { ... },
  "migration_order": [
    { "file": "1780358400000-create-calendars-table.ts", "deps": [] },
    { "file": "1780358400001-create-events-table.ts", "deps": ["calendars"] }
  ],
  "todo": [...]
}
```
이 정보로 PR 리뷰어가 timestamp 순서를 검증 가능.

## 2. 필수 구조 (TypeORM)
```ts
import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateUsersTable1716800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 스키마 변경
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // up의 역연산
  }
}
```
- **`up`과 `down` 둘 다 반드시 작성**. down이 없으면 rollback 불가 → 코드리뷰에서 reject.

## 3. 컬럼 / 인덱스 규약
- 모든 테이블 공통 컬럼 (04-data-layer.md §5):
  - `id uuid PK default gen_random_uuid()`
  - `created_at timestamptz default now() not null`
  - `updated_at timestamptz default now() not null`
  - `deleted_at timestamptz null` (soft delete 채택 시)
- 인덱스명: `idx_<table>_<col1>[_<col2>]`
- unique 제약: `uq_<table>_<col>`
- 외래키: `fk_<table>_<ref_table>`
- 인덱스 생성은 **테이블 생성과 같은 migration**에서 처리 (운영 규모 커지면 분리).

## 4. 데이터 마이그레이션 vs 스키마 마이그레이션
- 스키마 변경(테이블/컬럼/인덱스)과 데이터 변환(기존 row 갱신)은 **별도 파일**로 분리.
- 데이터 마이그레이션 파일명에는 `-data-` 포함: `1716800001000-data-backfill-user-roles.ts`
- 대용량 row 갱신은 batch 처리 (단일 UPDATE 금지) — lock 시간 최소화.

## 5. 안전 규칙
- 운영 DB에서 위험한 작업 (DROP COLUMN, NOT NULL 추가 등)은 2단계로:
  1. 컬럼 추가 + 더블 라이트 (DB 코드 동시 변경)
  2. 다음 배포에서 옛 컬럼 DROP
- `NOT NULL` 컬럼 추가 시 반드시 `default` 명시 또는 backfill 후 추가.
- 인덱스 생성은 PostgreSQL의 `CONCURRENTLY` 사용 권장 (운영 시점).

## 6. 실행 — 환경별 명령 분리 (Critical)

production Docker 이미지에는 `dist/`만 있고 `src/`는 없다. **ts-node 기반 명령은 production에서 100% 실패**한다 (`Cannot find module '/app/src/database/data-source.ts'`).

### package.json scripts 필수 분리

dev (ts-node 기반, src/ 가용):
```json
"typeorm": "typeorm-ts-node-commonjs -d src/database/data-source.ts",
"migration:run": "npm run typeorm -- migration:run",
"migration:revert": "npm run typeorm -- migration:revert",
"migration:generate": "npm run typeorm -- migration:generate"
```

prod (compiled JS 기반, dist/만 사용):
```json
"typeorm:prod": "node ./node_modules/typeorm/cli.js -d dist/database/data-source.js",
"migration:run:prod": "npm run typeorm:prod -- migration:run",
"migration:revert:prod": "npm run typeorm:prod -- migration:revert"
```

### entrypoint.sh — 환경 자동 판별
```bash
if [ "$RUN_MIGRATIONS" = "true" ]; then
  if [ -d dist ]; then
    echo "[entrypoint] RUN_MIGRATIONS=true -> migration:run:prod (dist-based)"
    npm run migration:run:prod
  else
    echo "[entrypoint] RUN_MIGRATIONS=true -> migration:run (ts-node, dev)"
    npm run migration:run
  fi
fi
```

### 자동 실행
- env `RUN_MIGRATIONS=true` (07-env-and-secrets.md §1) — 컨테이너 부팅 시 자동.
- 장기적으론 ECS one-off task가 더 안전 (배포 실패와 분리됨).

### 금지
- production 컨테이너에서 ts-node 기반 typeorm 명령(`typeorm-ts-node-commonjs ... -d src/...`) 호출 — src/ 없어서 무조건 실패.
- `migration:run`(dev용)을 production entrypoint에서 직접 호출 — `migration:run:prod` 사용.

### Dockerfile 규약 — alpine runtime healthCheck (Critical)

`node:20-alpine` 같은 슬림 베이스 이미지를 runtime stage로 쓸 때, **ECS task-def의 container `healthCheck` 명령이 이미지 안에서 실행 가능해야 한다.**

```yaml
# ECS task-def 예시
"healthCheck": {
  "command": ["CMD-SHELL", "curl -fsS http://localhost:5013/health || exit 1"]
}
```

기본 alpine은 `curl` 미포함 → healthCheck 항상 실패 → "(task) failed container health checks" → ECS가 task kill 반복 → rollout 무한 IN_PROGRESS.

Dockerfile runtime stage에 명령 설치 필수:
```dockerfile
FROM node:20-alpine AS runtime
RUN apk add --no-cache curl ca-certificates
```

또는 healthCheck를 `wget`/`node`로 변경 (예: `node -e "require('http').get('http://localhost:5013/health',r=>process.exit(r.statusCode===200?0:1))"`).

### data-source.ts export 규약 (Critical)
`src/database/data-source.ts`는 **DataSource를 정확히 한 번만 export**한다.

```ts
// ✅ OK
export const AppDataSource = new DataSource({...});

// ✅ OK
const ds = new DataSource({...});
export default ds;

// ❌ NG — TypeORM CLI가 거부
// "Given data source file must contain only one export of DataSource instance"
export const AppDataSource = new DataSource({...});
export default AppDataSource;
```

named export + default export 둘 다 하면 TypeORM CLI loader가 "must contain only one export" 에러로 즉시 실패. 한 가지만 골라서 사용.

## 7. 금지
- 마이그레이션 파일을 한 번 머지한 뒤 수정 금지 (이미 적용된 환경과 어긋남). 수정 필요 시 **새 migration 추가**.
- entity 변경만 하고 migration 누락 금지.
- 스키마 변경 PR과 비즈니스 로직 PR을 한 번에 섞지 말 것 (롤백 어려움).
