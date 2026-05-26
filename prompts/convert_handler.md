# Lambda Handler → Nest.js 변환 규칙

> 본 .md는 **마이그레이션 개발자(LLM)**에게 주는 절대 룰입니다. 신규 도메인 PR을 만들 때 본 문서를 가장 먼저 읽고 따르세요. 위반 시 ECS 부팅 실패 또는 Swagger 누락이 발생합니다.

## 대상 레포 = Nest.js (TypeScript)

`backend-migration` 레포는 **Nest.js 10+** + TypeScript + `@nestjs/swagger` 기준입니다. 단순 Express가 아닙니다.

## 🔴 R0. 레포 상태 자동 감지 (PR 생성 직전 의무)

신규 도메인 PR을 만들기 전에 **현재 main 브랜치의 인프라 상태를 자동 점검**하고, Express 잔재가 발견되면 **같은 PR에 인프라 전환을 반드시 포함**합니다. 도메인 코드만 추가하면 컨테이너에서 무시되어 dead code가 됩니다 (2026-05-26 PR #28 사고).

### 감지 알고리즘

GitHub MCP로 main 브랜치에서 다음 파일/내용을 grep:

```
file_exists('src/server.js')            → Express 잔재
file_exists('src/main.ts')              → Nest.js 진입점
file_contains('package.json', '"@nestjs/common"') → Nest.js 의존성
file_contains('package.json', '"express"' 단독)  → Express 의존성
file_exists('src/app.module.ts')        → Nest.js 루트 모듈
file_exists('nest-cli.json')            → Nest.js 빌드 설정
file_contains('Dockerfile', 'CMD ["node", "src/server.js"]') → Express 실행
file_contains('Dockerfile', 'CMD ["node", "dist/main.js"]')  → Nest.js 실행
```

### 분기 매트릭스

| 상태 | 동작 |
|---|---|
| `src/main.ts` + `app.module.ts` + `@nestjs/*` 의존성 모두 존재 | **Nest.js 환경** — 도메인 코드만 추가 (정상 흐름) |
| `src/server.js` 있고 `src/main.ts` 없음 | **Express 환경 — 같은 PR에 인프라 Nest.js 전환 강제 (§ R0.1)** |
| 둘 다 없음 (빈 레포) | **`setup_nestjs_project.md` 전체 파일 트리 생성 + 도메인 추가 (§ R0.2)** |
| 둘 다 있음 | 충돌 — `src/server.js` 삭제 의무 (§ R0.3) |

### R0.1 Express → Nest.js 전환이 같은 PR에 포함되어야 하는 파일들

> ⚠️ **app.module.ts 작성 시 의무**: GitHub API로 main 브랜치의 `src/domains/` 디렉토리를 list → 존재하는 **모든 도메인 폴더**에 대응되는 `<Domain>Module`을 imports에 함께 등록. 신규 도메인만 등록하면 기존 도메인 라우트가 mount 안 되어 404 (2026-05-26 우려 사례).
>
> ```ts
> // 예: main에 follow/, spark/ 가 있고 신규로 quiz/ 추가하는 PR
> @Module({
>   imports: [
>     ConfigModule.forRoot({ isGlobal: true }),
>     TypeOrmModule.forRootAsync(typeormConfig),
>     FollowModule,    // ← 기존 main의 도메인
>     SparkModule,     // ← 기존 main의 도메인
>     QuizModule,      // ← 본 PR 신규
>   ],
> })
> export class AppModule {}
> ```

**삭제**:
- `src/server.js`
- `src/middleware/errorHandler.js` (Nest.js의 AllExceptionsFilter로 대체)
- Express 전용 middleware (`src/middleware/auth.js` 등은 Guard로 대체)

**신규 생성** (`prompts/setup_nestjs_project.md` 참조):
- `src/main.ts` (Nest.js 진입점)
- `src/app.module.ts` (루트 모듈, 신규 도메인 Module 포함)
- `src/config/typeorm.config.ts` (`src/config/db.js` 대체)
- `src/common/result-code.ts`
- `src/common/interceptors/transform.interceptor.ts`
- `src/common/filters/all-exceptions.filter.ts`
- `src/common/exceptions/business.exception.ts`
- `src/auth/jwt-auth.guard.ts`
- `src/auth/current-user.decorator.ts`
- `nest-cli.json`
- `tsconfig.json`, `tsconfig.build.json`

**수정**:
- `package.json` — `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `@nestjs/typeorm`, `@nestjs/config`, `class-validator`, `class-transformer`, `typeorm`, `mysql2`, `reflect-metadata`, `rxjs` 추가. `"scripts.start": "node dist/main.js"`, `"scripts.build": "nest build"` 로 갱신. 옛 express/swagger-ui-express/swagger-jsdoc 제거.
- `Dockerfile` 또는 `deploy/Dockerfile` — TypeScript 빌드 단계 추가 + `CMD ["node", "dist/main.js"]`:
  ```dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY package.json package-lock.json* ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:20-alpine
  WORKDIR /app
  RUN apk add --no-cache bash jq aws-cli
  COPY --from=build /app/node_modules ./node_modules
  COPY --from=build /app/dist ./dist
  COPY package.json .
  COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
  RUN chmod +x /usr/local/bin/entrypoint.sh
  ENV NODE_ENV=production
  EXPOSE 5012
  ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
  CMD ["node", "dist/main.js"]
  ```

### R0.2 빈 레포 (`src/main.ts`도 `src/server.js`도 없음)

`prompts/setup_nestjs_project.md` 의 § 1~16 전체 파일을 모두 생성. 도메인 코드는 그 위에 얹음. 한 PR에 모두 포함.

### R0.3 충돌 상태 (둘 다 존재)

`src/server.js` + `src/main.ts` 가 같이 있으면 Docker가 어느 쪽을 실행할지 모호 → `src/server.js`와 Express 잔재를 **같은 PR에서 삭제** 의무.

### R0.4 절대 금지

- ❌ Express 환경에 `.controller.ts` 만 추가하고 PR 완료 → 컨테이너에서 dead code (PR #28 사고)
- ❌ `package.json`에 `@nestjs/*` 추가 없이 `.controller.ts` 작성 → 부팅 실패 또는 무반응
- ❌ `Dockerfile`의 `CMD` 안 바꾸고 Nest.js 코드 추가 → `node src/server.js` 가 실행되어 Nest.js 부팅 안 됨
- ❌ `app.module.ts` 없이 `<Domain>Module` 작성 → 라우터 mount 안 됨

### R0.5 PR 자가 점검 (자동 grep)

PR 생성 직전 다음을 모두 만족해야 PR 생성:

```
인프라:
✅ src/main.ts 존재
✅ src/app.module.ts 존재 AND <Domain>Module imports에 포함
✅ **기존 main의 `src/domains/*/` 에 있는 모든 도메인 Module도 app.module.ts.imports에 포함**
   (예: 현재 main에 follow/spark 디렉토리가 있으면 FollowModule, SparkModule을 신규 QuizModule과 함께 imports에 등록.
    누락 시 follow/spark 라우트가 mount 안 되어 404 응답)
✅ package.json 에 @nestjs/common 의존성 존재
✅ Dockerfile|deploy/Dockerfile 의 CMD가 dist/main.js (또는 nest start) 실행
✅ src/server.js 부재 (또는 본 PR에서 삭제)

도메인 코드:
✅ src/domains/<domain>/<domain>.{controller,service,module}.ts 3종 모두 존재
✅ @Controller('<domain>') decorator path와 디렉토리명 일치
✅ @ApiTags, @ApiOperation 모든 메서드에 존재

Entity:
✅ src/domains/<domain>/entities/ 폴더 존재
✅ Repository가 import하는 모든 Entity 파일이 entities/ 안에 실재
✅ <domain>.module.ts의 TypeOrmModule.forFeature([...])에 모든 Entity 등록
✅ Entity 필드명/타입이 prompts/api/domains/<domain>/overview.md의 컬럼 정의와 일치

DTO:
✅ 모든 @Body()/@Query()/@Param() 인자가 DTO 클래스로 받음
✅ 옵셔널 필드(?:)에 @IsOptional() 데코레이터 빠뜨림 없음
✅ query/path string을 number로 받는 필드에 @Type(() => Number) 존재
✅ 모든 검증 decorator에 한국어 message 옵션
✅ @ApiProperty / @ApiPropertyOptional 모든 필드에 존재
```

하나라도 실패 시 PR 거부 + 누락 항목 보강.

세부 룰은 다음 .md 참조:
- 인프라/도메인: 본 문서 § R0.1, 파일 구조
- Entity: `prompts/api/_shared/db-access.md` § Entity 정의
- DTO: `prompts/api/_shared/validation.md` § DTO 자가 점검 체크리스트

---


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
