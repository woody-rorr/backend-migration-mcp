# Lambda Handler → Nest.js 변환 규칙

> 본 .md는 **마이그레이션 개발자(LLM)**에게 주는 절대 룰입니다. 신규 도메인 PR을 만들 때 본 문서를 가장 먼저 읽고 따르세요. 위반 시 ECS 부팅 실패 또는 Swagger 누락이 발생합니다.

## 대상 레포 = Nest.js (TypeScript)

`backend-migration` 레포는 **Nest.js 10+** + TypeScript + `@nestjs/swagger` 기준입니다. 단순 Express가 아닙니다.

## 매핑 테이블

| Lambda (APIGatewayProxyEvent) | Nest.js |
|---|---|
| `event.pathParameters.x` | `@Param('x') x: string` |
| `event.queryStringParameters.x` | `@Query('x') x?: string` |
| `JSON.parse(event.body)` | `@Body() dto: SomeDto` (class-validator) |
| `event.headers.x` | `@Headers('x') x: string` |
| `event.requestContext.authorizer.claims` | `@CurrentUser() user: AuthUser` (custom decorator) |
| `return { statusCode, body }` | `return data;` (Interceptor가 응답 포맷 가공) |
| `context.callbackWaitsForEmptyEventLoop = false` | 제거 |
| `try { ... } catch { return resultCode.error }` | `throw new HttpException(...)` / `BadRequestException` (Exception Filter가 처리) |

## 파일 구조 (절대 규칙)

```
src/domains/<domain>/
├── <domain>.module.ts          ← @Module({ controllers, providers, imports })
├── <domain>.controller.ts      ← @Controller('<domain>') + @nestjs/swagger 데코레이터
├── <domain>.service.ts         ← @Injectable() — 비즈니스 로직
├── <domain>.repository.ts      ← @Injectable() — DB I/O. 선택이지만 권장
├── dto/
│   ├── <name>.dto.ts           ← class-validator + class-transformer
│   └── ...
└── entities/                   ← (TypeORM 사용 시) 엔티티 정의
```

### ⚠️ 파일명 절대 규칙

- 파일명: **`<domain>.controller.ts`** / **`<domain>.service.ts`** / **`<domain>.module.ts`** 고정.
  - ❌ `controller.ts`, `index.ts`, `<domain>Controller.ts`, `<domain>.handler.ts`
  - ✅ `follow.controller.ts`, `follow.service.ts`, `follow.module.ts`
- 디렉토리 이름은 도메인 슬러그 (예: `follow`, `spark`, `quiz`).
- 확장자는 `.ts`. ESM `.js` 사용 금지.

### Swagger 노출

`@nestjs/swagger` 사용 — JSDoc이 아닌 **데코레이터** 기반.

`src/main.ts` 에서 자동 스캔:

```ts
const config = new DocumentBuilder()
  .setTitle('Backend Migration API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api-docs', app, document);
```

**Controller에 반드시**:

```ts
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('follow')
@ApiBearerAuth()
@Controller('follow')
export class FollowController {
  @Get('my')
  @ApiOperation({ summary: '내 팔로우 목록' })
  @ApiResponse({ status: 200, description: 'OK' })
  async getMyFollows(@CurrentUser() user: AuthUser) { ... }
}
```

`@ApiTags`/`@ApiOperation` 누락 시 Swagger UI에는 path만 뜨고 설명 없음. 누락 금지.

## 부팅 안정성 (Boot-safety)

ECS Fargate에서 새 task가 부팅 즉시 죽으면 ECS는 옛 task로 계속 서빙 → **CI ✅인데 새 코드가 반영 안 됨**. 다음 룰로 부팅 실패를 원천 차단.

### 1. 모든 import 파일은 같은 PR에 존재해야 함

PR 생성 직전 본인이 만든 모든 `.ts`의 import 경로가 실제로 존재하는지 확인. 없으면 같은 PR에 stub 동봉.

### 2. `app.module.ts` 갱신 의무

신규 도메인을 추가할 때 **반드시** `src/app.module.ts`의 `imports` 배열에 `<Domain>Module`을 추가:

```ts
@Module({
  imports: [
    ConfigModule.forRoot({ ... }),
    TypeOrmModule.forRoot({ ... }),
    FollowModule,    // ← 신규 도메인 추가 시 같은 PR에 한 줄
    QuizModule,
    SparkModule,
  ],
})
export class AppModule {}
```

누락 시 라우트 자체가 mount 안 됨.

### 3. TypeScript path alias 금지

`tsconfig.json`의 `paths` (예: `@interface/*`) 잔재를 그대로 사용 금지. 모두 **상대경로**로 정규화:

```ts
// ❌ 금지
import { ResultResponse } from '@interface/Result.Interface';

// ✅ 허용
import { ResultResponse } from '../../common/result-response';
```

(Nest.js CLI가 alias를 잘 처리하긴 하지만 mismatch 시 빌드 실패 가능 — 상대경로가 안전)

### 4. 옛 파일/패턴 잔재 정리

- origin Lambda의 `<Domain>.Controller.ts`, `<Domain>.Services.ts`, `handler.ts` (대문자/PascalCase) 같은 옛 패턴이 같은 디렉토리에 있으면 **같은 PR에서 삭제**.
- 신규 파일이 옛 파일 import 금지 (같은 사고 재발 차단).
- `src/functions/`, `src/Interface/`, `src/libs/` 같은 origin 폴더 구조 잔재 금지.

### 5. CI/CD 워크플로우 보호 (절대)

**`.github/workflows/*` 파일은 절대 수정/삭제 금지.** 도메인 마이그레이션 PR이 CI/CD 워크플로우를 건드리면 배포 자동화가 깨집니다.

자동 적용:
- PR 생성 직전 `git diff --name-only main..` 결과에서 `.github/workflows/` 매칭되는 파일 발견 시 **PR 거부**
- CI/CD 변경이 필요하면 별도 PR (`ci/...` 브랜치)로 분리

### 6. server entry는 `src/main.ts` (Nest.js 표준)

- `src/server.js` 같은 Express 패턴 금지
- `package.json` `scripts.start`는 `nest start` 또는 `node dist/main`
- Dockerfile의 `CMD`는 빌드 결과 `dist/main.js` 실행

## 필수 의존 패키지 (package.json)

신규 도메인이 의존하는 Nest.js 표준:

```json
{
  "dependencies": {
    "@nestjs/common": "^10",
    "@nestjs/core": "^10",
    "@nestjs/platform-express": "^10",
    "@nestjs/swagger": "^7",
    "@nestjs/typeorm": "^10",
    "typeorm": "^0.3",
    "class-validator": "^0.14",
    "class-transformer": "^0.5",
    "reflect-metadata": "^0.2"
  }
}
```

없는 패키지 import 시 같은 PR에 `package.json`도 갱신.

## PR 자가 점검 체크리스트

PR 생성 직전 다음을 **자동 grep으로** 확인:

- [ ] `src/domains/<domain>/<domain>.{controller,service,module}.ts` 3종 모두 존재
- [ ] `@Controller('<domain>')` decorator path와 디렉토리명 일치
- [ ] `@ApiTags`, `@ApiOperation` 모든 라우트 메서드에 존재
- [ ] `src/app.module.ts`의 `imports`에 `<Domain>Module` 추가됨
- [ ] 신규 파일 어디에도 path alias(`@*/`) 사용 안 함
- [ ] 옛 파일/폴더(`<Domain>.Controller.ts`, `src/functions/*` 등) 잔재 없음
- [ ] `package.json`의 의존성에 신규 import한 모듈 다 있음
- [ ] **`.github/workflows/*` 변경 없음** (절대)
- [ ] `dto/*.dto.ts`에 class-validator decorator 적용됨

## 사고 사례 (재발 방지용)

- 2026-05-21 Express 시절: `spark.router.js` 옛 파일명 → Swagger 누락
- 2026-05-22 Express 시절: `src/middleware/auth.js` 누락 → `ERR_MODULE_NOT_FOUND`
- 2026-05-26 Express 시절: 신규 `routes.js`가 옛 `./spark.handler.js`를 import → path alias로 부팅 실패. CI/CD ✅인데 옛 task 유지, Swagger에 sample만 노출 (failedTasks 930회)
- 2026-05-26: 레포 전체 초기화. Nest.js로 재출발.
