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

## 모듈 등록
- `app.module.ts`의 `imports: [...]`에 추가.
- DB 엔티티는 `TypeOrmModule.forFeature([<Feature>Entity])` (ORM이 TypeORM인 경우).

## 산출물 체크리스트
- [ ] Swagger 태그 1개 (`@ApiTags('<feature>')`)
- [ ] 모든 엔드포인트에 `@ApiOperation` + `@ApiResponse`
- [ ] DTO에 `@ApiProperty` 데코레이터
- [ ] 인증 필요 시 controller 또는 메서드에 `@UseGuards(JwtAuthGuard)`
- [ ] 권한 필요 시 `@Roles(...)`
