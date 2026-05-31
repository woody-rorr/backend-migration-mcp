# app_module_integration — 신규 모듈을 자동으로 app.module.ts에 통합

> `module:<name>` scope 호출 시 **반드시** 다음 두 파일을 같이 산출해야 한다.
> 사용자에게 "수동으로 추가하세요" 같은 문구를 노출하지 않는다.

## 1. `src/app.module.ts`
신규 모듈이 추가될 때마다 이 파일을 통째로 다시 산출한다 (덮어쓰기).
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
| `module:<name>` | 누적된 모든 module 목록을 imports 에 포함해 **app.module.ts 재산출** (덮어쓰기) |
| `auth` | `JwtAuthGuard` provider 추가 (이미 §1 골격에 포함) |
| `publish` | 변경 없음 (publish 직전 마지막 module 호출에서 이미 정확한 상태) |

## 4. 누적 상태 유지
- 호출자(orchestrator 또는 handle_backend_request)는 매 scope 호출 시 직전 호출에서 **이미 push 된 모듈 목록**을 `extra_spec` 또는 `accumulated_modules` 로 주입한다.
- 본 MCP는 `accumulated_modules` 가 있으면 그 목록 + 이번 신규 모듈을 합쳐서 app.module.ts 를 갱신한다.

## 5. 금지 사항
- 응답 메시지에 "수동으로 app.module.ts에 추가하세요" 류 문구 금지.
- `app.module.ts` 를 patch/diff 형식으로 반환 금지 — **항상 전체 파일** 산출.
- 다른 모듈의 service를 직접 import 금지 (scaffold_module.md §5 동일).
