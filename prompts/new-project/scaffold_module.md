# scaffold_module — NestJS 모듈 생성 가이드

> `scaffold_new_project_api` 툴이 NestJS 모듈을 만들 때 따르는 패턴.

## 0. 호출 단위 정책 (Critical)

한 번의 `scaffold_new_project_api` 호출은 아래 **scope 중 정확히 1개만** 처리한다.
여러 scope가 요청되면 **첫 번째 scope만 생성**하고 나머지는 응답 `todo` 배열에 `"next: <scope>"` 형태로 기록한다.
각 scope의 산출 파일 수는 10개 이하로 유지 — 그 이상이면 잘게 쪼개서 다음 호출로 미룬다.

| scope | 산출 |
|---|---|
| `bootstrap` | package.json, tsconfig.json, tsconfig.build.json, nest-cli.json, .env.example, .gitignore, deploy/Dockerfile, .github/workflows/deploy.yml |

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
| `app-shell` | src/main.ts, src/app.module.ts, src/config/configuration.ts, src/common/{filters,interceptors,decorators}/* |
| `database` | src/database/data-source.ts, src/database/migrations/<ts>-create-<table>-table.ts (테이블 1개당 1 migration) |
| `module:<name>` | src/modules/<name>/* (entity, module, service, repository, controller, dto/*) |
| `auth` | src/modules/auth/* + strategies/* + guards/* (auth_patterns.md 따름) |
| `tests:<feature>` | src/modules/<feature>/__tests__/*.e2e-spec.ts (08-testing.md 따름) |
| `health` | src/modules/health/* (단순 모듈 1개) |
| `publish` | 코드 생성 없음 — 누적 파일을 GitHub MCP로 push + PR. `github_publish.md` 따름. |

### `module:<name>` 산출 시 필수 규약 (Critical)
- **반드시 `src/app.module.ts`도 같이 산출** — 신규 모듈을 imports에 포함하도록 전체 파일 덮어쓰기. `app_module_integration.md` §1 골격 사용.
- "수동으로 app.module.ts에 추가하세요" 같은 안내 문구를 응답에 포함하지 않는다. 응답은 코드 + todo(next scope)만.
- 호출자가 `accumulated_modules` (콤마 구분 문자열)를 task/extra_spec에 넘기면 그 목록 + 이번 신규 모듈을 합쳐 imports 갱신.

### `publish` scope 산출 규약 (Critical)
- 코드 생성 금지. `github_publish.md` §2 순서대로 `mcp__github__create_branch` → `push_files` → `create_pull_request` 호출.
- 누적된 모든 파일을 한 번에 push (단일 파일 push 금지).
- 응답에 `publish.pr_url` 포함.

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

## 모듈 등록
- `app.module.ts`의 `imports: [...]`에 추가.
- DB 엔티티는 `TypeOrmModule.forFeature([<Feature>Entity])` (ORM이 TypeORM인 경우).

## 산출물 체크리스트
- [ ] Swagger 태그 1개 (`@ApiTags('<feature>')`)
- [ ] 모든 엔드포인트에 `@ApiOperation` + `@ApiResponse`
- [ ] DTO에 `@ApiProperty` 데코레이터
- [ ] 인증 필요 시 controller 또는 메서드에 `@UseGuards(JwtAuthGuard)`
- [ ] 권한 필요 시 `@Roles(...)`
