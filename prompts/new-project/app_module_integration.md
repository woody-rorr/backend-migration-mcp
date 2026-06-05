# app_module_integration — 신규 모듈을 자동으로 app.module.ts에 통합

> `module:<name>` scope 호출 시 **반드시** 다음 두 파일을 같이 산출해야 한다.
> 사용자에게 "수동으로 추가하세요" 같은 문구를 노출하지 않는다.

## 1. `src/app.module.ts`

### 1.0 Critical: additive merge only (위반 시 기존 모듈 wipe 사고 재발)
**기존 레포에 이미 머지된 모듈은 절대 삭제하지 않는다.** 매 `module:<name>` 호출에서 app.module.ts를 새로 산출할 때, 호출자가 `accumulated_modules`로 모든 기존 모듈을 넘겨주지 않을 가능성이 있다. 따라서:

- **`module:<name>` scope**: app.module.ts를 **산출하지 않는다**. 호출자의 누적 정보가 불완전할 수 있으므로 module scope에서는 새 모듈 파일들만 만든다.
- **`publish` scope**: github_publish.md §2.0에 따라 target 레포의 main에 있는 app.module.ts를 GitHub MCP로 fetch → 신규 모듈만 imports 배열에 **append** → push.

기존 정책(통째 재생성)은 신규 부트스트랩 시점(`app-shell` scope, target 레포가 빈 상태일 때)에만 적용.

### 1.1 포함 규칙 (app-shell scope 또는 publish merge 결과 기준)
포함 규칙:
- `imports`: 누적된 모든 feature 모듈 (`<Name>Module`) + 공통(`ConfigModule.forRoot`, `ThrottlerModule`, `TypeOrmModule.forRoot(AppDataSource.options)`)
- `providers`:
  - `{ provide: APP_GUARD, useClass: ThrottlerGuard }`
  - 인증 사용 모듈이 1개 이상이면 `{ provide: APP_GUARD, useClass: JwtAuthGuard }` 추가
  - 인증이 필요 없는 엔드포인트는 컨트롤러/메서드에 `@Public()` 데코레이터로 표시 (auth_patterns.md §)
- `controllers`: 비워둠 (모듈이 자체 controller 보유)

표준 골격:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { AppDataSource } from './database/data-source';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { HealthModule } from './modules/health/health.module';
// === FEATURE MODULE IMPORTS ===
// 누적된 module:<name> 마다 한 줄씩 (예: import { QuizModule } from './modules/quiz/quiz.module';)

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    TypeOrmModule.forRoot(AppDataSource.options),
    AuthModule,
    HealthModule,
    // === FEATURE MODULES ===
    // (QuizModule, AttemptModule, ...) 누적
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
```

## 2. `src/database/data-source.ts`
신규 migration 또는 entity가 추가될 때마다 entities 배열 / migrations glob이 신규 파일을 포함하도록 보장.
- `entities: [__dirname + '/../**/*.entity.{ts,js}']` (glob — 자동 포함)
- `migrations: [__dirname + '/migrations/*.{ts,js}']` (glob — 자동 포함)

위 glob을 쓰면 신규 entity/migration 추가 시 별도 등록 코드 변경 불필요.

## 3. scope별 책임
| scope | app.module.ts 처리 |
|---|---|
| `app-shell` | 위 §1 골격으로 최초 생성 (feature 0개) |
| `module:<name>` | **app.module.ts 산출 안 함** — §1.0 참조. 새 모듈 파일들만 생성. |
| `auth` | `JwtAuthGuard` provider 추가 (이미 §1 골격에 포함) |
| `publish` | github_publish.md §2.0 — target main의 기존 app.module.ts를 fetch해서 신규 모듈만 append (additive merge). |

## 4. 누적 상태 유지
- 호출자(orchestrator 또는 handle_backend_request)는 매 scope 호출 시 직전 호출에서 **이미 push 된 모듈 목록**을 `extra_spec` 또는 `accumulated_modules` 로 주입한다.
- 본 MCP는 `accumulated_modules` 가 있으면 그 목록 + 이번 신규 모듈을 합쳐서 app.module.ts 를 갱신한다.

## 5. 금지 사항
- 응답 메시지에 "수동으로 app.module.ts에 추가하세요" 류 문구 금지.
- `app.module.ts` 를 patch/diff 형식으로 반환 금지 — **항상 전체 파일** 산출.
- 다른 모듈의 service를 직접 import 금지 (scaffold_module.md §5 동일).
