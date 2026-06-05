# scaffold_module — NestJS 모듈 생성 가이드

> `scaffold_new_project_api` 툴이 NestJS 모듈을 만들 때 따르는 패턴.

## 0. 호출 단위 정책 (Critical)

한 번의 `scaffold_new_project_api` 호출은 아래 **scope 중 정확히 1개만** 처리한다.
여러 scope가 요청되면 **첫 번째 scope만 생성**하고 나머지는 응답 `todo` 배열에 `"next: <scope>"` 형태로 기록한다.
각 scope의 산출 파일 수는 10개 이하로 유지 — 그 이상이면 잘게 쪼개서 다음 호출로 미룬다.

| scope | 산출 |
|---|---|
| `bootstrap` | package.json, tsconfig.json, tsconfig.build.json, nest-cli.json, .env.example, .gitignore, deploy/Dockerfile, .github/workflows/deploy.yml, **src/main.ts (최소 부트), src/app.module.ts (빈 AppModule)** |

### `bootstrap` 산출 시 필수 규약 (Critical)

MCP 는 `npm` 을 실행할 수 없으므로 **`package-lock.json` 은 산출하지 않는다**. 따라서:

1. **`deploy/Dockerfile`** 의 의존성 설치 단계는 lock 유무에 관계없이 동작해야 한다:
   ```dockerfile
   COPY package*.json ./
   RUN if [ -f package-lock.json ]; then npm ci; \
       else npm install --no-audit --no-fund; fi
   ```
   runtime 스테이지도 같은 패턴 (`npm ci --omit=dev` ↔ `npm install --omit=dev`).

2. **`.github/workflows/deploy.yml`** 은 docker buildx 직전에 lock 부재 시 자동 생성:
   ```yaml
   - uses: actions/setup-node@v4
     with: { node-version: '20' }
   - name: Generate lockfile if missing
     run: |
       if [ ! -f package-lock.json ]; then
         npm install --package-lock-only --no-audit --no-fund
       fi
   ```

운영자가 추후 로컬에서 `npm install` 후 `package-lock.json` 을 커밋하면 두 단계 모두 결정적 빌드(`npm ci`)로 자동 전환된다. 이 fallback 패턴을 빼면 scaffold 직후 첫 배포가 항상 실패한다 (관측 사례: 2026-05-28).

3. **`tsconfig.json`** 은 TypeORM entity 와 호환되도록 `strictPropertyInitialization: false` 를 반드시 포함:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "strictPropertyInitialization": false,
       "strictNullChecks": true,
       "noImplicitAny": true,
       ...
     }
   }
   ```
   누락 시 entity 필드마다 TS2564 발생 → `nest build` 가 수십 개 에러로 실패 (관측 사례: 2026-05-28, 44 errors).

3.1 **`deploy/Dockerfile` HEALTHCHECK start-period 60s 이상 (Critical)** — migration:run + Nest 부팅 시간 합쳐 충분히 잡아야 새 task가 ALB health check 통과 전에 죽지 않음:
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
     CMD curl -fsS http://localhost:5013/health || exit 1
   ```
   `start-period=20s` 같이 짧으면 → ALB가 task 죽임 → rollout 무한 실패 → 옛 task만 살아서 신규 코드 반영 안 됨 (관측 사례: 2026-06-02 blogs PR #32, 새 task 부팅됐는데 ALB가 kill → /blogs 404).

3.2 **`/health` 엔드포인트는 DB 의존성 X (Critical)** — `HealthController`는 즉시 200 반환만, DB ping 같은 외부 의존성 호출 금지:
   ```ts
   @Public()
   @Get()
   check() { return { status: 'ok', uptime: process.uptime() }; }
   ```
   migration:run 진행 중에도 health check가 빨리 통과해야 ALB가 task 살림. DB readiness는 별도 `/ready` 엔드포인트로 분리 권장 (선택).

3.3 **`.github/workflows/deploy.yml` 에 ECS healthCheckGracePeriodSeconds 120 설정 (Critical)** — Force new deployment 직후 ALB가 task 검사하기 전 grace period 충분히. CI/CD 단계에서 명시:
   ```yaml
   - name: Set health check grace period
     run: |
       aws ecs update-service \
         --cluster ${{ env.CLUSTER }} \
         --service ${{ env.SERVICE }} \
         --health-check-grace-period-seconds 120 \
         --region ${{ env.AWS_REGION }} > /dev/null
   ```
   기본값 0 또는 60 이면 짧아서 task kill 발생.

3.4 **`bootstrap` 단독 머지 후에도 `npm run start`가 성공해야 함 (Critical)** — bootstrap PR만 머지된 시점에서도 로컬 `npm install && npm run build && npm run start`가 부팅 가능한 빈 NestJS 앱이 떠야 한다. 따라서 bootstrap 산출에 **최소 부트 골격 2개 파일을 반드시 포함**:

   **`src/main.ts`**
   ```ts
   import { NestFactory } from '@nestjs/core';
   import { AppModule } from './app.module';

   async function bootstrap() {
     const app = await NestFactory.create(AppModule);
     await app.listen(process.env.PORT ?? 5013);
   }
   bootstrap();
   ```

   **`src/app.module.ts`** (빈 AppModule — 이후 `module:<name>` scope가 imports 채움)
   ```ts
   import { Module } from '@nestjs/common';

   @Module({ imports: [], controllers: [], providers: [] })
   export class AppModule {}
   ```

   이 두 파일이 누락되면 bootstrap PR 머지 직후 `nest start`가 `Cannot find module '.../dist/main'`로 실패 → 운영자가 로컬 검증 불가, Docker 빌드 시 entry 부재로 ECS task 무한 재시작 (관측 사례: 2026-06-05). `app-shell` scope에서는 이 두 파일을 **덮어쓰기**해서 ValidationPipe / Swagger / 글로벌 prefix 등을 추가한다.

4. **`package.json` `dependencies` 화이트리스트 (Critical)** — 이후 scope들이 import할 모든 런타임 패키지를 bootstrap 단계에서 빠짐없이 포함한다. 누락되면 후속 scope 머지 후 `nest build`가 TS2307로 실패한다 (관측 사례: 2026-06-01, `@nestjs/jwt` 누락 → CI exit 1, 배포 무산).

   필수(NestJS 10 기본):
   - `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`
   - `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`

   조건부 — **하나라도 추후 scope에서 import할 가능성이 보이면 bootstrap에 미리 넣는다**:
   | 추후 등장하는 scope/패턴 | 동반 dep |
   |---|---|
   | `auth` scope (`AuthGuard('jwt')`, `JwtModule`, `JwtService`) | `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt`, `bcrypt` + devDep `@types/passport-jwt`, `@types/bcrypt` |
   | `database` scope (TypeORM) | `@nestjs/typeorm`, `typeorm`, `pg` (또는 `mysql2`) |
   | env 검증 (`validationSchema`) | `joi` |
   | rate limit (`ThrottlerModule`) | `@nestjs/throttler` |
   | uuid 생성 (`uuid` lib 사용 시) | `uuid` + devDep `@types/uuid` |

   **bootstrap scope 응답 직후 LLM은 자체 검증**: 사용자 의도에 `로그인/회원가입/JWT/인증` 키워드가 하나라도 있으면 위 `auth` 행을 무조건 포함. 누락 시 `todo: ["spec-fix: bootstrap에 @nestjs/jwt 등 auth deps 누락 — 재호출 필요"]` 반환.
| `app-shell` | src/main.ts, src/app.module.ts, src/config/configuration.ts, src/common/{filters,interceptors,decorators}/* |
| `database` | src/database/data-source.ts, src/database/migrations/<ts>-create-<table>-table.ts (테이블 1개당 1 migration) |
| `module:<name>` | src/modules/<name>/* (entity, module, service, repository, controller, dto/*) |
| `auth` | src/modules/auth/* + strategies/* + guards/* (auth_patterns.md 따름) |
| `tests:<feature>` | src/modules/<feature>/__tests__/*.e2e-spec.ts (08-testing.md 따름) |
| `health` | src/modules/health/* (단순 모듈 1개) |
| `modify:<name>` | 기존 모듈 수정 — entity/dto/service 갱신 + 신규 **ALTER 마이그레이션** 추가. 기존 `create-*-table.ts` 수정 금지. 아래 §"`modify:<name>` 산출 규약" 따름. |
| `delete:<name>` | 모듈 제거 — `src/modules/<name>/` 전체 + `src/app.module.ts` import 라인 제거. 아래 §"`delete:<name>` 산출 규약" 따름. |
| `publish` | 코드 생성 없음 — 누적 파일을 GitHub MCP로 push + PR. `github_publish.md` 따름. |

### `app-shell` 산출 시 필수 규약 (Critical)
- **`src/main.ts`는 `06-runtime-rules.md` §1의 "정본 main.ts" 블록을 그대로 사용** — bootstrap의 최소 main.ts를 **완전 덮어쓰기**.
- 필수 포함 항목 (하나라도 빠지면 응답 차단):
  1. `useGlobalPipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))`
  2. `enableCors({...})` — `CORS_ORIGINS` env 파싱
  3. `SwaggerModule.setup('api-docs', app, document, { jsonDocumentUrl: 'api-docs-json' })` — `DocumentBuilder` + `createDocument` 포함
  4. `app.enableShutdownHooks()`
  5. `app.listen(process.env.PORT ?? 5013)`
- **자체 검증 절차** (응답 직전 LLM이 수행):
  1. files 맵의 `src/main.ts` 본문에 `SwaggerModule.setup`, `useGlobalPipes`, `enableCors`, `enableShutdownHooks` 4개 토큰이 **모두** 포함되었는지 확인
  2. 하나라도 누락 시 `todo: ["spec-fix: app-shell main.ts 필수 항목 누락: <token>"]` 응답 + 코드 생성 차단
- **bootstrap의 `package.json` `dependencies`에 `@nestjs/swagger`, `class-validator`, `class-transformer` 포함 여부 확인** — 누락이면 todo로 spec-fix 요구.
- 관측 사례: 2026-06-05 PR #58 — bootstrap의 빈 main.ts가 app-shell에서 덮어쓰기 안 되어 Swagger UI/JSON 모두 404. 머지·배포 후 운영자가 수동 발견.

### `module:<name>` 산출 시 필수 규약 (Critical)
- **반드시 `src/app.module.ts`도 같이 산출** — 신규 모듈을 imports에 포함하도록 전체 파일 덮어쓰기. `app_module_integration.md` §1 골격 사용.
- "수동으로 app.module.ts에 추가하세요" 같은 안내 문구를 응답에 포함하지 않는다. 응답은 코드 + todo(next scope)만.
- 호출자가 `accumulated_modules` (콤마 구분 문자열)를 task/extra_spec에 넘기면 그 목록 + 이번 신규 모듈을 합쳐 imports 갱신.
- **테이블 자동 생성 (Critical, 2026-06-01 사고 방지)** — 신규 모듈에 entity가 있으면 `src/database/migrations/<timestamp>-create-<table>-table.ts`를 **같은 호출 응답에 반드시 포함**한다. 별도 `database` scope를 todo로 미루지 않는다. 누락 시 ECS 부팅 후 첫 API 호출이 `relation "<table>" does not exist` 로 실패.
  - 마이그레이션 파일 1개 = 테이블 1개. 외래키 제약은 참조 테이블의 마이그레이션 timestamp 이후로 정렬.
  - `entrypoint.sh` 가 컨테이너 부팅 시 `migration:run:prod` 를 실행하므로 머지 즉시 테이블이 생성된다 (수동 SQL 금지).
  - 응답에 `app.module.ts` 만 있고 마이그레이션이 없으면 LLM 자체 검증으로 차단: `todo: ["spec-fix: module:<name> 에 entity 있는데 migration 누락 — 재산출 필요"]`.
- **entity 파일 의무 산출 (Critical, 2026-06-04 사고 방지)** — `<name>.module.ts` 또는 `<name>.repository.ts` 가 `./entities/<X>.entity` 를 import 하면, 대응 entity 파일을 **같은 호출 응답 files 맵에 반드시 포함**한다. entities/ 폴더 통째로 누락하는 사고가 빈번 (관측 사례: 2026-06-04 PR #42 quiz — 3개 entity 누락 → `nest build` TS2307 → 머지해도 빌드 실패).
  - **자체 검증 절차** (응답 직전 LLM이 수행):
    1. files 맵에서 `src/modules/<name>/<name>.module.ts` 와 `src/modules/<name>/<name>.repository.ts` 의 `import ... from './entities/X'` 줄 추출
    2. 각 X마다 `src/modules/<name>/entities/X.entity.ts` 가 files 맵에 있는지 확인
    3. 누락 발견 시 `todo: ["spec-fix: <name> 모듈 entity 누락: <X.entity.ts>, ..."]` 응답 + 코드 생성 차단
  - **entity 파일 최소 구조**:
    ```ts
    import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
    @Entity('<table_name>')
    export class <Name> {
      @PrimaryGeneratedColumn('uuid') id: string;
      // ... 도메인 필드 (snake_case 컬럼명은 @Column({ name: '...' }) 명시)
      @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
      @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
    }
    ```
  - migration의 컬럼명/타입과 entity 의 `@Column` 옵션이 **반드시 일치** (snake_case 컬럼은 `@Column({ name: 'snake_case' })` 명시). 불일치 시 runtime SELECT/INSERT에서 `column "X" does not exist` 발생.

### `modify:<name>` 산출 규약 (Critical — 필드/엔드포인트 수정)

기존 모듈을 변경하는 요청(필드 추가/삭제/타입 변경, 엔드포인트 추가, 상태머신 확장 등)은 **`module:<name>` 으로 재산출하지 않고 `modify:<name>`** 으로 처리한다. 재산출은 ALTER 가 아닌 새 CREATE 가 돼 운영 DB와 충돌한다 (관측 사례: 2026-06-01 사용자 우려 — "수정 요청 들어오면?").

대상 산출(한 호출 = 한 변경 단위):
1. **entity 파일 갱신** — `src/modules/<name>/entities/<name>.entity.ts` (변경된 필드/메서드만 반영, 나머지 그대로 유지)
2. **DTO 갱신** — 영향받는 `dto/*.dto.ts` (예: 새 필드 → `CreateXDto`, `UpdateXDto`)
3. **service/controller 갱신** — 시그니처 변경이 있을 때만
4. **신규 ALTER 마이그레이션** — `src/database/migrations/<new-timestamp>-alter-<table>-<짧은_설명>.ts`. **기존 `create-*-table.ts` 절대 수정 금지** (이미 운영 DB에서 run 됐으므로 idempotent 깨짐). 항상 새 파일 추가.
   - 예: `1780300000000-alter-orders-add-tracking-number.ts` — `up: ALTER TABLE "orders" ADD COLUMN tracking_number ...` / `down: ALTER TABLE "orders" DROP COLUMN tracking_number`
   - 컬럼 삭제는 항상 `down`에서 같은 컬럼을 `ADD` 로 복원하도록 (롤백 가능).
5. **테스트 갱신** — `__tests__/<feature>.e2e-spec.ts` 의 영향 케이스 갱신 (선택, `tests:<feature>` scope로 분리 가능).

응답 규약:
- `files` 맵에 변경된 파일 + 신규 ALTER 마이그레이션 1개.
- `deletions` 사용 금지 (수정에는 파일 삭제 없음).
- 호출자(`extra_spec`)는 변경 사항을 **diff 형태로 명시**해야 함. 예: `"OrderEntity에 trackingNumber:varchar(50) nullable 추가. CreateOrderDto에도 동일 필드 옵션 추가."`.
- 사양이 모호하면 (`"orders 테이블 좀 바꿔줘"` 같이) 코드 생성 금지하고 `todo: ["spec-required: 변경할 필드/엔드포인트를 명시"]`.

위험 변경 가드:
- 컬럼 타입 변경 (`varchar(255)` → `text` 등): 무손실이면 그대로, 손실 가능성(`text` → `varchar(10)`)이면 `todo: ["risk: 손실 가능 — 사용자 승인 필요"]` 반환 후 대기.
- 컬럼 삭제 / 테이블 rename: 항상 `todo: ["risk: 파괴적 변경 — 사용자 명시 승인 필요"]` 반환. extra_spec에 `"confirm_destructive: true"` 가 있을 때만 진행.

### `delete:<name>` 산출 규약 (Critical — 절반 삭제 금지)

모듈 제거는 **반드시 한 호출에서 다음을 모두 처리**한다. 일부만 지우면 잔재 파일이 깨진 import를 만들어 `nest build` 실패 (관측 사례: 2026-06-01, `src/modules/news/posts/posts.repository.ts` + `posts.service.ts` 만 남고 `dto/`·`entities/` 삭제 → TS2307 5개, CI exit 1).

산출(=삭제) 대상 묶음 — 빠짐없이 한 PR에 포함:
1. `src/modules/<name>/<name>.module.ts`
2. `src/modules/<name>/<name>.controller.ts`
3. `src/modules/<name>/<name>.service.ts`
4. `src/modules/<name>/<name>.repository.ts`
5. `src/modules/<name>/dto/` 디렉토리 전체
6. `src/modules/<name>/entities/` 디렉토리 전체
7. `src/modules/<name>/__tests__/` 디렉토리 전체 (존재 시)
8. `src/database/migrations/*-create-<table>-table.ts` (해당 모듈 전용 테이블이면)
9. **`src/app.module.ts` 갱신** — 해당 `<Name>Module` import 라인과 `imports: [...]` 등록 라인 제거. 전체 파일을 새 내용으로 덮어쓰기.

응답 규약:
- `files` 맵에는 갱신된 `src/app.module.ts` 한 개만 (다른 파일들은 삭제 대상이므로 맵에 넣지 않음).
- 별도 필드 `deletions: ["src/modules/<name>/..."]` 에 위 1~8 경로를 모두 나열한다.
- `publish` scope가 `deletions` 를 보면 `mcp__github__delete_file` 을 각 경로마다 호출 후 `push_files` 로 `app.module.ts` 갱신.

검증: LLM은 응답 직전 `deletions` 가 `src/modules/<name>/` 하위 파일을 **모두** 포함하는지 확인. 일부만 들어있으면 코드 생성 금지하고 `todo: ["spec-fix: delete:<name> 일부 파일 누락 — 전체 묶음 필요"]` 반환.

### `publish` scope 산출 규약 (Critical)
- 코드 생성 금지. `github_publish.md` §2 순서대로 `mcp__github__create_branch` → `push_files` → `create_pull_request` 호출.
- 누적된 모든 파일을 한 번에 push (단일 파일 push 금지).
- 응답에 `publish.pr_url` 포함.

### `publish` 안전 게이트 (Critical — 사고 방지)
publish 호출 시 아래 조건 검사. 위반 시 push 금지하고 `todo: ["abort: <이유>"]` 응답:

1. **부트스트랩만 push 금지**: 누적 files 맵에 `src/modules/<name>/` 경로가 0개이고 부트스트랩 파일(`package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example`, `deploy/Dockerfile`, `.github/workflows/deploy.yml`, `.gitignore`)만 있으면 push abort. `"abort: 모듈 코드 없음. module:<name> scope 먼저 호출"` 응답.
2. **기존 레포 부트스트랩 덮어쓰기 차단**: target 레포(`woody-rorr/backend`)에 push 전 `mcp__github__get_file_contents`로 `package.json` 존재 여부 확인. 이미 존재하면 누적 files 맵에서 다음 경로 제거 후 push: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.env.example`, `.gitignore`, `deploy/Dockerfile`, `deploy/entrypoint.sh`, `.github/workflows/deploy.yml`. (기존 인프라 보존)
3. **제거 후 push할 파일이 0개**면 abort: `"abort: 신규 추가할 코드 없음 (전부 기존 인프라와 중복)"`.

응답 `todo` 예시:
```json
"todo": [
  "next: app-shell",
  "next: database (users table)",
  "next: module:users",
  "next: auth",
  "next: tests:auth"
]
```

호출자(로컬 Claude)는 이 `todo`를 읽고 자동으로 다음 호출을 이어간다. 결과는 누적해 한 PR로 push한다.

## 모듈 1개 = 파일 묶음

```
src/modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts        # DB 접근 격리
├── dto/
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── <feature>-response.dto.ts
└── entities/
    └── <feature>.entity.ts
```

## 규칙
1. controller는 HTTP/Swagger 데코레이터만, 비즈니스 로직 금지.
2. service는 transaction 경계. repository를 호출하고 DTO ↔ entity 매핑.
3. repository는 ORM 직접 호출만. 비즈니스 규칙 금지.
4. DTO는 `class-validator` 데코레이터로 03-api-contract.md의 §3 표를 충실히 옮긴다.
5. 다른 모듈의 service를 직접 import 금지. 필요한 경우 `exports` 명시된 것만.

## UC 명세 → service 코드 매핑 (Critical)

`05-use-cases.md` 의 UC 표가 입력으로 주어진 경우, 아래 매핑을 **기계적으로** 적용한다. 자율 해석 금지.

| UC 명세 항목 | 코드 산출 |
|---|---|
| §(1) API 매핑 | controller 메서드의 `@Method('path')`, `@UseGuards(...)`, `@ApiOperation` |
| §(2) 입력 DTO | `dto/<verb>-<noun>.dto.ts` — class-validator 데코레이터 |
| §(3) 사전조건 | service 메서드 진입부 가드절 (각 항목 1개 = if/throw 1개) |
| §(4) 처리 단계 표 | **service 메서드 본문 = 표의 행 순서 그대로**. 행 1개 = 코드 1블록. 순서 변경/병합 금지 |
| §(4) `mutate` 분류 행 | repository 직접 호출 금지. **반드시 entity 메서드 호출** (`order.cancel()`) — 불변식 검증을 엔티티 안으로 가둠 |
| §(4) `emit` 분류 행 | 트랜잭션 commit 이후에 실행 (트랜잭션 콜백 밖) |
| §(5) 트랜잭션 경계 | `dataSource.transaction(async (mgr) => { ... })` 또는 `@Transactional()` 위치를 begin/commit 행에 정확히 배치 |
| §(6) 에러 케이스 표 | **각 행 = `throw new HttpException({ code, message }, status)` 한 번**. 표에 없는 throw 금지. 표에 있는데 코드에 없는 throw 금지 |
| §(7) 사후조건 | 코드 산출에는 직접 반영 없음. e2e 테스트(`tests:<feature>` scope)가 assertion으로 변환 |
| §(8) 응답 DTO | `dto/<noun>-response.dto.ts` + service 반환부에서 매핑 |

### 추가 강제 규칙
- 처리 단계 표의 한 행이 `validate/load/authorize/mutate/persist/emit` 6분류 외 값이면 LLM은 코드 생성 대신 `todo: ["spec-fix: UC-XX step N의 분류가 비표준"]` 응답.
- UC에 `TBD` 가 남아 있으면 그 절에 해당하는 코드를 비워두고 `todo: ["spec-fix: UC-XX §<N> TBD"]` 응답에 명시.
- 에러 케이스 표의 `code` 는 응답 JSON 의 `error.code` 필드와 정확히 일치 (`06-runtime-rules.md` 에러 포맷).
- controller에는 절대로 비즈니스 분기(`if/else`)나 DB 호출 금지. UC 표의 항목이 controller로 새면 매핑 실패.

## Creative Mode — 명세 없이 자유 창작 (Opt-in)

사용자 task 또는 extra_spec에 다음 키워드 중 하나라도 포함되면 **creative mode** 활성:
- `creative`, `freestyle`, `자유롭게`, `맘대로`, `알아서`, `네가 정해`, `좋은 퀄리티`, `퀄리티 좋게`

활성 시 `scaffoldNewProjectApi.js` 시스템 프롬프트 §9~11(명시 정의 강제 / 추측 금지 / 필드 임의 추가 금지)을 **이 호출 한정 해제**하고 아래 규칙으로 대체.

### Creative Mode 규칙
1. **엔티티 필드 자유 추가** — 도메인 통상 패턴으로 합리적인 필드 추가 (예: Quiz → `title`, `description`, `questions`, `timeLimit`, `difficulty`, `passingScore`, `attemptsLimit` 등).
2. **상태머신 능동 도입** — 도메인에 자연스러우면 `draft → published → archived` 같은 상태 추가. 엔티티 메서드(`quiz.publish()`, `quiz.archive()`)로 전이 표현.
3. **비즈니스 룰 능동 도입** — 다음을 항상 고려:
   - 권한 가드 (본인 소유 리소스만 수정/삭제)
   - 횟수/시간 제한 (예: 하루 N회 응시, 시간 초과 차단)
   - 상태 전이 규칙 (예: archived 상태는 수정 불가)
   - 멱등성 (중복 호출 차단)
4. **service 메서드 = entity 메서드 호출 패턴** — `quiz.attemptBy(user, answers)` 같이 엔티티에 비즈니스 행위 메서드 두기. **thin CRUD `repo.save()` 직호출 금지**.
5. **도메인 특화 에러 코드 자유 작명** — `QUIZ_ALREADY_ATTEMPTED`, `ATTEMPT_TIME_EXCEEDED`, `INSUFFICIENT_PERMISSION` 등. HTTP status 매핑은 `06-runtime-rules.md` 규약 따름.
6. **트랜잭션 경계 능동 결정** — 다단계 mutate + persist 있으면 `dataSource.transaction()`로 감싸기.

### Creative Mode 의무 — `creative_decisions` 보고
응답 JSON에 다음 필드 필수 포함:
```json
{
  "files": { ... },
  "creative_decisions": [
    "엔티티 Quiz에 attemptsLimit(int) 추가 — 무한 응시 방지",
    "QuizAttempt 분리 — 응시 이력 추적 필요",
    "상태머신: draft → published → archived 도입",
    "QUIZ_ALREADY_ATTEMPTED 에러 코드 도입 — 같은 사용자 재응시 차단",
    "트랜잭션: attempt 생성 + quiz.attemptCount 증가 묶음"
  ],
  "todo": [ ... ]
}
```

`creative_decisions`는 PR body에도 포함되어 사용자가 한눈에 "MCP가 뭘 발명했는지" 보게 함.

### Creative Mode 비활성 (기본값)
키워드 없으면 §9~11 그대로 적용 — 명세 없으면 `spec required` 응답.

## 모듈 등록
- `app.module.ts`의 `imports: [...]`에 추가.
- DB 엔티티는 `TypeOrmModule.forFeature([<Feature>Entity])` (ORM이 TypeORM인 경우).

## 산출물 체크리스트
- [ ] Swagger 태그 1개 (`@ApiTags('<feature>')`)
- [ ] 모든 엔드포인트에 `@ApiOperation` + `@ApiResponse`
- [ ] DTO에 `@ApiProperty` 데코레이터
- [ ] 인증 필요 시 controller 또는 메서드에 `@UseGuards(JwtAuthGuard)`
- [ ] 권한 필요 시 `@Roles(...)`
