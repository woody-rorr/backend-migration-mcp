# scopes/app-shell — main.ts 정본 + 글로벌 인프라 (Critical)

**산출:** src/main.ts, src/app.module.ts, src/config/configuration.ts, src/common/{filters,interceptors,decorators}/*

## 0. 사전 점검
`common/precheck.md` 1~3 단계만 (FK 검증 skip).

## 1. `src/main.ts` 정본 사용
`resources/new-project/06-runtime-rules.md` §1 의 "정본 main.ts" 블록을 그대로 사용. bootstrap 의 최소 main.ts 를 **완전 덮어쓰기**.

## 2. 필수 포함 항목 (하나라도 빠지면 응답 차단)
1. `useGlobalPipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))`
2. `enableCors({...})` — `CORS_ORIGINS` env 파싱
3. `SwaggerModule.setup('api-docs', app, document, { jsonDocumentUrl: 'api-docs-json' })` — `DocumentBuilder` + `createDocument` 포함
4. `app.enableShutdownHooks()`
5. `app.listen(process.env.PORT ?? 5013)`

## 3. 자체 검증 절차 (응답 직전 LLM 수행)
1. files 맵의 `src/main.ts` 본문에 `SwaggerModule.setup`, `useGlobalPipes`, `enableCors`, `enableShutdownHooks` 4개 토큰이 **모두** 포함되었는지 확인.
2. 하나라도 누락 시 `todo: ["spec-fix: app-shell main.ts 필수 항목 누락: <token>"]` 응답 + 코드 생성 차단.

## 4. deps 사전 확인
bootstrap 의 `package.json` `dependencies` 에 `@nestjs/swagger`, `class-validator`, `class-transformer` 포함 여부 확인. 누락이면 todo 로 spec-fix 요구.

## 관측 사례
2026-06-05 PR #58 — bootstrap 의 빈 main.ts 가 app-shell 에서 덮어쓰기 안 되어 Swagger UI/JSON 모두 404. 머지·배포 후 운영자가 수동 발견.
