# Nest.js 프로젝트 초기 셋업 (backend-migration)

> 처음 또는 reset 후 빈 레포 상태에서 LLM이 만들어야 하는 인프라 파일들. 도메인 코드가 mount되기 전에 **부팅 가능한 빈 골격**이 먼저 들어가야 함.

## 필요한 파일 트리

```
backend-migration/
├── .github/workflows/deploy.yml      ← CI/CD (절대 수정 금지, 별도 PR로만)
├── .gitignore
├── Dockerfile
├── deploy/
│   └── entrypoint.sh                 ← SSM → env 주입 후 node 기동
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── main.ts                       ← Nest.js 진입점
    ├── app.module.ts                 ← 루트 모듈
    ├── auth/
    │   ├── jwt-auth.guard.ts
    │   └── current-user.decorator.ts
    ├── common/
    │   ├── result-code.ts
    │   ├── interceptors/
    │   │   └── transform.interceptor.ts
    │   ├── filters/
    │   │   └── all-exceptions.filter.ts
    │   └── exceptions/
    │       └── business.exception.ts
    └── config/
        └── typeorm.config.ts
```

## 1. `package.json`

```json
{
  "name": "backend-migration",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/swagger": "^7.1.0",
    "@nestjs/typeorm": "^10.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "mysql2": "^3.6.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "typeorm": "^0.3.17"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

## 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true
  }
}
```

## 3. `tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

## 4. `nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
```

## 5. `src/main.ts`

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Backend Migration API')
    .setVersion('1.0.0')
    .setDescription('API migrated from Lambda to ECS (Nest.js)')
    .addBearerAuth()
    .addServer('http://mcp-agents-staging-alb-249976027.us-east-1.elb.amazonaws.com:5012', 'Staging')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = parseInt(process.env.PORT ?? '5012', 10);
  await app.listen(port);
  console.log(`backend-migration listening on :${port}`);
  console.log(`Swagger: /api-docs`);
}
bootstrap();
```

## 6. `src/app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormConfig } from './config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(typeormConfig),
    // 도메인 Module은 동적으로 수집 — main의 src/domains/* + 본 PR 신규
    // (도메인 이름 하드코딩 금지. convert_handler.md § R0.1 참조)
  ],
})
export class AppModule {}
```

## 7. `src/config/typeorm.config.ts`

```ts
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const typeormConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => ({
    type: 'mysql',
    host: cfg.get<string>('DB_HOST'),
    port: cfg.get<number>('DB_PORT') ?? 3306,
    username: cfg.get<string>('DB_USER'),
    password: cfg.get<string>('DB_PASSWORD'),
    database: cfg.get<string>('DB_NAME'),
    autoLoadEntities: true,
    synchronize: false,       // 절대 true 금지 (운영 DB 보호)
  }),
};
```

## 8. `src/common/result-code.ts`

공통 코드 + 도메인별 비즈니스 코드를 한 곳에 모으는 enum.

```ts
export const resultCode = {
  // 공통 (모든 도메인 사용)
  Success: '0000',
  error: '1000',
  validationError: '5000',

  // 도메인별 코드는 각 도메인의 business-rules.md § resultCode 매핑 섹션을
  // 보고 자동 추가 (아래 § R-RC 룰 참조)
} as const;

export type ResultCode = typeof resultCode[keyof typeof resultCode];
```

### R-RC. 도메인별 resultCode 자동 동기화 (절대 규칙)

도메인 마이그레이션 PR이 추가될 때마다 다음을 같이 수행:

1. **출처**: `prompts/api/domains/<domain>/business-rules.md` 의 `resultCode` 매핑 표/섹션
2. **수집**: 해당 도메인이 throw하는 모든 비즈니스 코드 이름 (예: `FOLLOW_NOT_EXISTS`, `QUIZ_MATCH_NOT_ALLOWED`)
3. **변환**:
   - enum 키: PascalCase (`FollowNotExists`)
   - enum 값: SCREAMING_SNAKE_CASE 문자열 (`'FOLLOW_NOT_EXISTS'`)
   - 보통 도메인 prefix 유지 (`Follow*`, `Quiz*`)
4. **추가 위치**: 본 PR의 `src/common/result-code.ts` 같은 객체에 다른 코드와 함께 등록
5. **중복 차단**: 같은 키가 이미 있으면 추가 안 함 (기존 값 우선)

### 흔히 빠뜨리는 사고

- ❌ 도메인 코드 추가 안 하고 Service에서 `throw new BusinessException('FOLLOW_NOT_EXISTS', ...)` 만 작성
  → 런타임은 동작하지만 응답에 사용되는 `resultCode.FollowNotExists` 가 undefined → 클라이언트 분기 깨짐
- ❌ 다른 도메인의 코드를 본 도메인이 throw (예: spark가 `FollowNotExists` throw)
  → 도메인 경계 위반. 본 도메인의 코드만 throw, 다른 도메인 코드가 필요하면 그 service 호출 후 전파
- ❌ 코드 이름을 origin Lambda와 다르게 변경
  → 클라이언트는 origin 코드명으로 분기하므로 그대로 옮길 것

### 자가 점검 (PR 생성 직전)

- [ ] 본 PR이 추가하는 도메인의 `business-rules.md` § resultCode 의 모든 코드가 `result-code.ts` 에 존재
- [ ] Service의 `throw new BusinessException('CODE', ...)` 의 첫 인자가 `result-code.ts`의 값과 일치
- [ ] 기존 코드 (Success/error/validationError + 옛 도메인 코드) 보존

## 9. `src/common/interceptors/transform.interceptor.ts`

`_shared/response-format.md` 참조 — 동일 코드.

## 10. `src/common/filters/all-exceptions.filter.ts`

`_shared/error-handling.md` 참조 — 동일 코드.

## 11. `src/common/exceptions/business.exception.ts`

`_shared/error-handling.md` 의 `BusinessException` 코드 그대로.

## 12. `src/auth/jwt-auth.guard.ts` + `current-user.decorator.ts`

`_shared/auth-context.md` 참조 — 동일 코드.

## 13. `Dockerfile`

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

## 14. `deploy/entrypoint.sh`

```bash
#!/usr/bin/env bash
set -e

PREFIX="${SSM_PREFIX:-/backend-migration-api-service}"
echo "[entrypoint] Loading SSM parameters from prefix '$PREFIX'"

PARAMS_JSON=$(aws ssm get-parameters-by-path \
  --path "$PREFIX" --recursive --with-decryption \
  --region "${AWS_REGION:-us-east-1}" 2>/dev/null || echo '{"Parameters":[]}')

COUNT=$(echo "$PARAMS_JSON" | jq -r '.Parameters | length')
echo "[entrypoint] Loaded $COUNT parameter(s) from SSM"

while read -r line; do
  [ -z "$line" ] && continue
  export "$line"
done < <(echo "$PARAMS_JSON" | jq -r --arg prefix "$PREFIX" \
  '.Parameters[] | (.Name | sub($prefix + "/"; "") | gsub("/"; "_") | ascii_upcase) + "=" + .Value')

echo "[entrypoint] Executing: $@"
exec "$@"
```

## 15. `.gitignore`

```
node_modules/
dist/
.env
.env.*
*.log
.DS_Store
package-lock.json
```

## 16. `.github/workflows/deploy.yml`

**이 파일은 인프라 영역. 도메인 마이그레이션 PR이 절대 수정/삭제하면 안 됨** (`prompts/convert_handler.md` § 5 참조). 신규 셋업 시 한 번만 만들고 그 후 별도 CI 변경 PR로만 갱신.

내용은 reset 직전 `4e37d67` commit의 deploy.yml 그대로 사용 — `npm ci && npm run build` 단계 추가만 필요할 수 있음 (Express 시절 워크플로우와 거의 동일).

## 17. SSM 파라미터 (운영자 사전 등록 필요)

| 키 | 용도 |
|---|---|
| `/backend-migration-api-service/DB_HOST` | DB 호스트 |
| `/backend-migration-api-service/DB_PORT` | DB 포트 |
| `/backend-migration-api-service/DB_USER` | DB 사용자 |
| `/backend-migration-api-service/DB_PASSWORD` | DB 비밀번호 (SecureString) |
| `/backend-migration-api-service/DB_NAME` | DB 이름 |
| `/backend-migration-api-service/JWT_SECRET` | JWT 검증 키 (SecureString) |

entrypoint.sh가 이들을 `DB_HOST`, `DB_PORT`, ... 식으로 env에 주입.

## 18. ECS Task Role 권한

- `ssm:GetParametersByPath` on `arn:aws:ssm:us-east-1:239460481239:parameter/backend-migration-api-service/*`
- CloudWatch Logs 쓰기 권한
- (필요 시) ECR pull은 execution role에

## 부팅 검증

```bash
curl http://<ALB>:5012/health        # → {"status":"ok","server":"backend-migration"}
curl http://<ALB>:5012/api-docs/     # → Swagger UI HTML (200)
```

## 도메인 추가 흐름

1. 본 셋업이 main에 들어가 있음 (한 번만)
2. 신규 도메인 PR → `src/domains/<d>/<d>.{module,controller,service}.ts` + `app.module.ts`의 `imports`에 `<D>Module` 추가
3. CI/CD가 자동 배포 → Swagger UI에 노출
