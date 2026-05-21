# Lambda Handler → Express Router 변환 규칙

## 매핑 테이블

| Lambda (APIGatewayProxyEvent) | Express |
|---|---|
| `event.pathParameters.x` | `req.params.x` |
| `event.queryStringParameters.x` | `req.query.x` |
| `JSON.parse(event.body)` | `req.body` (express.json() 미들웨어 가정) |
| `event.headers.x` | `req.headers.x` (lowercase) |
| `event.requestContext.authorizer.claims` | `req.user` (인증 미들웨어가 주입) |
| `return { statusCode, body }` | `res.status(statusCode).type('json').send(body)` |
| `context.callbackWaitsForEmptyEventLoop = false` | 제거 |

## 콜드 스타트 → 웜 프로세스 전환

- DB pool은 모듈 top-level에서 1회 초기화, 라우터에서 재사용.
- AWS SDK 클라이언트도 top-level 1회.
- 환경변수 검증은 부팅 시 1회 (`src/config/env.js`).

## 에러 처리

- `try/catch` 후 `next(err)`로 위임 → app-level error middleware가 statusCode/body로 응답.
- Lambda에서 직접 `return { statusCode: 500, body: JSON.stringify({error}) }` 하던 코드는 `throw err`로 변환.

## CORS / Auth

- 핸들러 내부 CORS 헤더 세팅 제거 — app-level `cors()` 미들웨어로 통합.
- JWT 검증도 핸들러에서 제거 — `authMiddleware`로 분리.

## 파일 출력 규약

- 라우터: `src/routes/<domain>.js`
- 비즈니스 로직: `src/handlers/<domain>.js` (기존 핸들러 내부 로직 그대로 export)
- 라우터는 비즈니스 로직만 import해서 req/res 어댑팅만 담당.
