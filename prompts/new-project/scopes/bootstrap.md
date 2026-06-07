# scopes/bootstrap — 신규 레포 부트스트랩 (Critical)

**산출:** package.json, tsconfig.json, tsconfig.build.json, nest-cli.json, .env.example, .gitignore, deploy/Dockerfile, .github/workflows/deploy.yml, **src/main.ts (최소 부트), src/app.module.ts (빈 AppModule)**

## 0. 사전 점검
`common/precheck.md` 1~3 단계만 (FK 검증 skip — 신규 레포라 자원 없음).

## 1. package-lock.json 미산출 정책
MCP 는 `npm` 을 실행할 수 없으므로 **`package-lock.json` 은 산출하지 않는다**.

### `deploy/Dockerfile` — lock 유무 무관 동작
```dockerfile
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; \
    else npm install --no-audit --no-fund; fi
```
runtime 스테이지도 같은 패턴 (`npm ci --omit=dev` ↔ `npm install --omit=dev`).

### `.github/workflows/deploy.yml` — lock 부재 시 자동 생성
```yaml
- uses: actions/setup-node@v4
  with: { node-version: '20' }
- name: Generate lockfile if missing
  run: |
    if [ ! -f package-lock.json ]; then
      npm install --package-lock-only --no-audit --no-fund
    fi
```
운영자가 추후 로컬에서 `package-lock.json` 을 커밋하면 두 단계 모두 결정적 빌드(`npm ci`)로 자동 전환. 이 fallback 빼면 scaffold 직후 첫 배포 항상 실패 (관측: 2026-05-28).

## 2. tsconfig.json — TypeORM 호환
```json
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false,
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```
`strictPropertyInitialization: false` 누락 시 entity 필드마다 TS2564 → `nest build` 수십 개 에러 (관측: 2026-05-28, 44 errors).

## 3. Dockerfile HEALTHCHECK — start-period 60s 이상 (Critical)
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:5013/health || exit 1
```
`start-period=20s` 처럼 짧으면 → ALB 가 task kill → rollout 무한 실패 → 옛 task만 살아서 신규 코드 미반영 (관측: 2026-06-02 blogs PR #32).

## 4. `/health` 엔드포인트 — DB 의존성 X (Critical)
```ts
@Public()
@Get()
check() { return { status: 'ok', uptime: process.uptime() }; }
```
migration:run 진행 중에도 health check 가 빨리 통과해야 ALB 가 task 살림. DB readiness 는 별도 `/ready` 분리 권장.

## 5. `.github/workflows/deploy.yml` — healthCheckGracePeriodSeconds 120
```yaml
- name: Set health check grace period
  run: |
    aws ecs update-service \
      --cluster ${{ env.CLUSTER }} \
      --service ${{ env.SERVICE }} \
      --health-check-grace-period-seconds 120 \
      --region ${{ env.AWS_REGION }} > /dev/null
```
기본값 0/60 이면 짧아서 task kill.

## 6. 최소 부트 골격 — `src/main.ts` + `src/app.module.ts` (Critical)
bootstrap PR 만 머지된 시점에도 `npm install && npm run build && npm run start` 가 부팅 가능해야 한다.

### `src/main.ts`
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 5013);
}
bootstrap();
```

### `src/app.module.ts` (빈 AppModule)
```ts
import { Module } from '@nestjs/common';

@Module({ imports: [], controllers: [], providers: [] })
export class AppModule {}
```

누락 시 bootstrap PR 머지 직후 `nest start` 가 `Cannot find module '.../dist/main'` 로 실패 → Docker 빌드 시 entry 부재로 ECS task 무한 재시작 (관측: 2026-06-05). `app-shell` scope 가 이 두 파일을 덮어쓰기.

## 7. `package.json` `dependencies` 화이트리스트 (Critical)
이후 scope 들이 import 할 모든 런타임 패키지를 bootstrap 단계에서 빠짐없이 포함. 누락 시 후속 scope 머지 후 `nest build` TS2307 (관측: 2026-06-01, `@nestjs/jwt` 누락 → CI exit 1).

### 필수 (NestJS 10)
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`
- `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`

### 조건부 — 추후 scope 에서 쓸 가능성 있으면 미리 포함
| 추후 등장 scope/패턴 | 동반 dep |
|---|---|
| `auth` scope (`AuthGuard('jwt')`, `JwtModule`) | `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt`, `bcrypt` + devDep `@types/passport-jwt`, `@types/bcrypt` |
| `database` scope (TypeORM) | `@nestjs/typeorm`, `typeorm`, `pg` (또는 `mysql2`) |
| env 검증 (`validationSchema`) | `joi` |
| rate limit (`ThrottlerModule`) | `@nestjs/throttler` |
| uuid 생성 | `uuid` + devDep `@types/uuid` |

**자체 검증:** 사용자 의도에 `로그인/회원가입/JWT/인증` 키워드가 있으면 `auth` 행 무조건 포함. 누락 시 `todo: ["spec-fix: bootstrap에 @nestjs/jwt 등 auth deps 누락 — 재호출 필요"]`.
