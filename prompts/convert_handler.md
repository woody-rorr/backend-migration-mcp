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

## 파일 출력 규약 (필수)

대상 레포(`backend-migration`)는 도메인별 디렉토리 구조를 사용합니다.

```
src/domains/<domain>/routes.js     ← 라우터 (Express Router)
src/domains/<domain>/handler.js    ← 비즈니스 로직 (req/res 분리해서 export)
```

### ⚠️ 절대 규칙

- 라우터 파일명은 **반드시 `routes.js`** (복수형, 확장자 외 접두/접미 금지).
  - ❌ `spark.router.js`, `<domain>.routes.js`, `index.js`
  - ✅ `routes.js`
- 핸들러 파일명은 **반드시 `handler.js`** (단수형).
- 디렉토리 이름은 도메인 슬러그 그대로 (`sample`, `follow`, `spark` 등).

### 왜 강제하는가

`server.js`의 Swagger 설정이 다음 glob으로 라우터 파일을 스캔하기 때문:

```js
apis: ["./src/domains/*/routes.js"]
```

**파일명을 `routes.js`로 두지 않으면 Swagger UI(`/api-docs`)에 라우트가 노출되지 않습니다.** 라우트는 살아 있지만 문서에서 사라져 신규 도메인이 머지된 줄도 모르게 됩니다 (실제 spark 도메인이 이 이유로 누락된 사례 발생, 2026-05-21).

### Swagger 주석 (JSDoc) 의무

각 라우트 위에 `@swagger` JSDoc 블록을 **반드시** 작성합니다 (대상 레포는 `swagger-jsdoc`을 사용하며 태그는 `@swagger`로 고정):

```js
/**
 * @swagger
 * /follow/list:
 *   get:
 *     tags: [follow]
 *     summary: 팔로우 목록 조회
 *     responses:
 *       200: { description: OK }
 */
router.get("/list", handler.list);
```

JSDoc이 없으면 라우트는 동작하지만 Swagger UI에는 안 뜹니다. `@openapi`/`@api` 등 다른 태그명은 인식되지 않습니다.
