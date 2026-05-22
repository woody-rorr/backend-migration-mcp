# 마이그레이션 타겟 스택

## 런타임

- Node.js 20 + Express 4
- ESM (`"type": "module"`) — 모든 import는 **`.js` 확장자 명시 필수**
- TypeScript 미사용 (원본이 TS여도 JS로 변환)

## 폴더 구조 (현 실제 레포 기준)

```
backend-migration/
├── src/
│   ├── server.js                 # Express app + Swagger 설정 + listen(5012)
│   ├── domains/
│   │   └── <domain>/
│   │       ├── routes.js         # Express Router (반드시 이 파일명!)
│   │       └── handler.js        # 비즈니스 로직 (반드시 이 파일명!)
│   ├── middleware/               # auth, errorHandler 등
│   ├── config/                   # env, db pool
│   └── common/ (필요시)           # 공용 유틸. TS path alias 대체
├── deploy/
│   ├── Dockerfile
│   └── entrypoint.sh             # SSM 주입 → `node src/server.js` 실행
└── package.json
```

> ⚠️ `src/routes/`, `src/handlers/` 같은 옛 구조 절대 만들지 말 것. `src/domains/<domain>/` 만 사용.

## 부팅 순서

1. `deploy/entrypoint.sh` → SSM `/backend-migration-api-service/*` 환경변수 주입
2. `node src/server.js` 실행
3. `src/config/env.js` (env 검증) → `src/config/db.js` (pool 생성) → `server.js`가 `app.listen(5012)`

## 시크릿 관리

- DB URL, 외부 API key 등은 AWS SSM Parameter Store에 저장
- `deploy/entrypoint.sh`가 부팅 시 SSM에서 가져와 env로 주입
- 코드에서 `process.env.X`로 읽음

## Swagger UI — 로컬 + ECS 두 곳에서 모두 노출 보장 (절대 규칙)

### `src/server.js`가 만족해야 하는 조건

```js
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const PORT = parseInt(env.PORT, 10) || 5012;
const ALB_HOST = "mcp-agents-staging-alb-249976027.us-east-1.elb.amazonaws.com";

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Backend Migration API",
      version: "1.0.0",
      description: "API migrated from Lambda to ECS Express",
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: "Local dev" },
      { url: `http://${ALB_HOST}:5012`, description: "Staging ALB (ECS)" },
    ],
  },
  apis: ["./src/domains/*/routes.js"], // ⚠️ 이 glob 절대 변경 금지
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### 노출 URL (도메인 추가 후 즉시 확인 가능해야 함)

| 환경 | URL |
|---|---|
| 로컬 | `http://localhost:5012/api-docs/` |
| ECS (Staging) | `http://mcp-agents-staging-alb-249976027.us-east-1.elb.amazonaws.com:5012/api-docs/` |

### 각 라우트는 `@swagger` JSDoc 의무

```js
/**
 * @swagger
 * /<domain>/<path>:
 *   <method>:
 *     tags: [<domain>]
 *     summary: ...
 *     responses:
 *       200: { description: OK }
 */
router.<method>("/<path>", handler.fn);
```

JSDoc 없으면 라우트는 동작하지만 Swagger UI에 노출 안 됨 — **마이그레이션 완료 기준 미충족**으로 간주.

### 로컬 실행 방법 (개발자 가이드)

```bash
cd backend-migration
npm install
node src/server.js
# → http://localhost:5012/api-docs/ 접속해서 신규 도메인 보이는지 확인
```

부팅 즉시 죽으면 그 시점에 잡고 `convert_handler.md`의 점검 1~4 수행 (TS alias, 누락 미들웨어, 옛 파일 잔재, server.js 정합성).

## 마이그레이션 완료 정의 (Definition of Done)

신규 도메인 PR은 다음을 **모두** 충족해야 머지 가능:

1. ✅ `src/domains/<d>/routes.js` 존재 (정확한 파일명)
2. ✅ `src/domains/<d>/handler.js` 존재 (정확한 파일명)
3. ✅ 모든 라우트에 `@swagger` JSDoc 블록
4. ✅ `src/server.js`에 import + `app.use("/<d>", ...)` 두 줄 추가됨
5. ✅ 모든 import가 실제 파일 또는 npm 패키지로 해석 가능 (TS path alias 없음, 누락 파일 stub 동봉)
6. ✅ `node src/server.js` 로컬에서 즉시 부팅 성공
7. ✅ `http://localhost:5012/api-docs/` 및 ECS URL에서 신규 도메인 path가 보임
