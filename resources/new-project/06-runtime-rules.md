# Runtime Rules

> NestJS의 guard / interceptor / filter / pipe 전역 설정.
> 모든 모듈이 따라야 하는 cross-cutting 규약.

## 1. Bootstrap (`main.ts`)
필수 설정:
- `ValidationPipe`: `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`
- 전역 prefix: `app.setGlobalPrefix('', { exclude: ['/health'] })` (controller 단위 path로 관리)
- CORS: origin 허용 목록은 env (`CORS_ORIGINS`, comma-separated).
- Swagger: `/api-docs`
- Graceful shutdown: `app.enableShutdownHooks()`

## 2. 인증 (Authentication)
- 방식: **JWT (Bearer)**
- 검증 모듈: `@nestjs/passport` + `passport-jwt`
- 토큰 발급 주체: **TBD** — (a) 본 서비스 자체발급 / (b) 외부 IdP 공유
- 페이로드 스키마 (예시):
```ts
type JwtPayload = {
  sub: string;        // user id
  email?: string;
  roles: string[];
  iat: number;
  exp: number;
};
```
- 검증 실패 → `401 { code: 'UNAUTHORIZED' }`

## 3. 인가 (Authorization)
- `@Roles('admin')` 데코레이터 + `RolesGuard`.
- 리소스 소유권 체크는 service 레이어에서 (guard는 role 단위까지만).
- 권한 부족 → `403 { code: 'FORBIDDEN' }`

## 4. Exception Filter (전역)
- 모든 예외 → `{ code, message, details?, traceId }` 형태로 변환.
- 코드 매핑:
  - `BadRequestException` → `VALIDATION_ERROR`
  - `NotFoundException` → `RESOURCE_NOT_FOUND`
  - `ConflictException` → `CONFLICT`
  - `UnauthorizedException` → `UNAUTHORIZED`
  - `ForbiddenException` → `FORBIDDEN`
  - `UnprocessableEntityException` → `BUSINESS_RULE_VIOLATION`
  - 그 외 → `INTERNAL_ERROR` (스택은 로그에만, 응답에는 미포함)

## 5. Logging Interceptor
- 구조화 JSON 로그 (CloudWatch Logs Insights 친화).
- 필수 필드:
  - `traceId` (요청당 1개, `x-trace-id` 헤더 우선 사용)
  - `method`, `path`, `statusCode`, `durationMs`
  - `userId` (JWT에서 추출, 없으면 null)
- PII/비밀 로깅 금지: `password`, `authorization` 헤더, 토큰 값.

## 6. Rate Limit
- `@nestjs/throttler` 전역 적용.
- 기본: 100 req / 60s / IP.
- 인증 엔드포인트(`/auth/login` 등)는 더 강하게: 10 req / 60s.

## 7. Validation 정책
- 모든 입력은 DTO로 정의 (controller에서 `@Body() / @Query() / @Param()`).
- DTO 없는 raw body 수신 금지.
- 변환은 `class-transformer` 자동 (`enableImplicitConversion: true`).

## 8. 헬스체크
- `GET /health` → 항상 200, JWT 우회 (`@Public()`).
- DB 연결 체크 옵션: `GET /health/ready` (readiness probe — TBD).

## 9. Graceful Shutdown
- SIGTERM 수신 → `app.close()` → 진행 중인 요청 완료 대기 (max 30s).
- DB 커넥션 풀 정상 종료.

## 10. 시간 / 타임존
- DB는 UTC 저장.
- 응답은 ISO 8601 (`2026-05-27T10:00:00Z`).
- 클라이언트 로컬 변환은 프론트 책임.
