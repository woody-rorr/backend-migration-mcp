# Lambda Handler → Express Router 변환 규칙

## ⛔ 변환 시작 전 필수 사전 점검 (Pre-flight)

**ECS 배포 현실:** `src/server.js`는 모든 도메인을 한 번에 import합니다. 다른 도메인 **단 한 곳**이라도 깨진 import가 있으면 새 task가 부팅 즉시 죽고, ECS는 옛 task를 유지합니다 (= CI ✅인데 스웨거 안 바뀜).

**그러므로 신규 도메인 PR을 만들기 전에 GitHub MCP를 통해 main의 `src/server.js`와 모든 `src/domains/<x>/*.js`를 읽어서 다음을 점검·정리합니다:**

### 점검 1. TypeScript path alias 잔재 (`@xxx/yyy`)

`@configuration/secretLoader`, `@interface/resultCode`, `@libs/api-gateway` 등 `@`로 시작하면서 **실제 npm 패키지가 아닌** import는 ESM에서 해석 불가 → 부팅 실패.

- 발견 시: 같은 PR에 해당 import를 **상대경로 + `.js`** 로 치환하거나, 해당 모듈이 없으면 stub 파일 동봉
- alias가 가리키던 유틸이 1~2줄이면 사용처에 인라인해서 import 자체 제거

### 점검 2. 누락된 미들웨어/유틸 파일

`../../middleware/<x>.js`, `../../config/<x>.js`, `../../common/<x>.js` 등 상대경로 import 중 **실제로 main에 없는 파일** 전부 식별.

- 발견 시: 같은 PR에 pass-through stub 자동 동봉 (아래 § "부팅 안정성" 참조)

### 점검 3. 옛 파일명 규약 위반 잔재

`<domain>.router.js`, `<domain>.handler.js`, `<domain>.Controller.js` 같은 옛 패턴이 같은 도메인 디렉토리에 존재하면:

- 같은 디렉토리에 `routes.js`/`handler.js`가 새로 생겼다면 **옛 파일을 같은 PR에서 삭제** (server.js와 import 충돌 방지)
- 새로 만들 도메인이라면 처음부터 신규 규약(`routes.js`/`handler.js`)만 사용

### 점검 4. server.js 일치성

- 신규 도메인 추가 시 `src/server.js`에 `import <d>Router from "./domains/<d>/routes.js"; app.use("/<d>", <d>Router);` 두 줄 같이 추가
- 도메인 삭제 시 server.js의 해당 import + `app.use` 라인도 같은 PR에서 제거

> **이 4가지 점검을 PR 생성 전에 자동 수행하면, ECS 부팅 실패로 스웨거가 안 바뀌는 사고는 발생하지 않습니다.** 점검 결과 정리해야 할 파일이 신규 도메인 외에 발견되면 PR description에 "Pre-flight cleanup: 다음 파일 정리 동봉" 섹션으로 명시.

---

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

## 부팅 안정성 (Boot-safety) — 절대 규칙

ECS Fargate에서 새 task가 부팅하면서 즉시 죽으면 ECS는 옛 task로 계속 서빙해 **CI는 ✅인데 새 코드가 반영 안 되는 상황**이 됩니다. 다음 규칙으로 부팅 실패를 원천 차단합니다.

### 1. 모든 import 파일은 같은 PR에 존재해야 함 (자동 stub 의무)

**PR 생성 직전에 본인이 만든 모든 `routes.js` / `handler.js`를 스캔해서 import 경로가 실제로 파일이 존재하는지 확인합니다.** 존재하지 않으면 같은 PR에 자동으로 stub 파일을 추가합니다.

#### 기존 레포에 이미 있는 것 (재생성 금지)

| 파일 | 용도 |
|---|---|
| `src/middleware/errorHandler.js` | Express error middleware |
| `src/config/db.js` | DB pool (`pool` export) |
| `src/config/env.js` | 환경변수 (`env` export) |

→ 이 4개는 절대 새로 만들지 마세요 (덮어쓰기 금지).

#### Lambda authorizer/JWT 관련 import는 100% stub 동봉

Lambda 핸들러가 `event.requestContext.authorizer.claims` 등을 쓰던 코드는 Express에서 미들웨어로 분리되는데, 실제 JWT 검증 로직은 마이그레이션 범위 밖입니다. **import한 미들웨어가 레포에 없으면 다음과 같은 pass-through stub을 같은 PR에 자동 생성하세요:**

```js
// src/middleware/<name>.js
export function <importedName>(req, _res, next) { next(); }
export default <importedName>;
```

#### 자동 적용 알고리즘

1. 본인이 생성/수정한 모든 파일에서 `import ... from '../../middleware/<x>.js'` 추출
2. 각 `<x>.js`가 `src/middleware/`에 이미 있는지 확인
3. 없으면 위 형태의 pass-through stub을 PR에 동봉
4. `default export`와 `named export` 둘 다 포함 (둘 중 어느 패턴으로 import됐을지 모름)

**과거 사고 (자동 stub 누락으로 ECS task가 부팅 즉시 ERR_MODULE_NOT_FOUND로 죽음):**
- 2026-05-22: `auth.js` (`authMiddleware`) — spark, follow 도메인
- 2026-05-22: `jwtAuth.js` (`verifyJWT`) — quiz 도메인
- 2026-05-22: `adminAuth.js` (`verifyAdmin`) — quiz 도메인

위 알고리즘으로 매 PR마다 일관 적용하면 이런 부팅 실패가 발생하지 않습니다.

### 2. `src/server.js`의 import 라인 갱신 의무

새 도메인을 추가할 때 **반드시** `src/server.js`에:

```js
import <domain>Router from "./domains/<domain>/routes.js";
// ...
app.use("/<domain>", <domain>Router);
```

두 줄이 같은 PR에 함께 들어가야 합니다. 누락 시 라우트가 mount 안 됨.

### 3. import 경로 정합성

- 라우터의 import는 ESM 상대경로 + **`.js` 확장자 필수** (Node ESM 규칙).
- 디렉토리 깊이는 `src/domains/<domain>/` 기준 `../../middleware/`, `../../config/`로 고정.
- 예전 패턴 (`spark.router.js`, `<domain>.routes.js`)은 절대 생성 금지 — 같은 디렉토리에 두 라우터가 공존하면 server.js import 충돌.

### 3-1. TypeScript path alias 절대 사용 금지

원본 Lambda가 `@interface/resultCode`, `@common/utils` 같은 **path alias**를 쓰던 경우, 변환 결과에서 그대로 두면 안 됩니다. 대상 레포는 순수 ESM Node 프로젝트라 `tsconfig.json`의 `paths`나 `jsconfig.json` 별칭이 적용되지 않아 **부팅 시 `ERR_MODULE_NOT_FOUND: Cannot find package '@xxx/yyy'`로 즉사**합니다.

| Lambda 원본 | 변환 결과 |
|---|---|
| `import { ok } from '@interface/resultCode'` | `import { ok } from '../../common/resultCode.js'` (실제 파일 경로) |
| `import x from '@common/utils'` | `import x from '../../common/utils.js'` 또는 함수 본문에 인라인 |
| `import { foo } from '@app/db'` | 인라인 또는 기존 `../../config/db.js` 활용 |

**원칙:**
- 모든 import는 **상대경로 + `.js`** 로 정규화
- 원본의 alias가 가리키던 모듈이 대상 레포에 없으면, 같은 PR에 해당 유틸 파일을 같이 생성 (예: `src/common/resultCode.js` stub)
- 핸들러가 사용하던 헬퍼 함수가 1~2줄 짜리면 import 대신 핸들러 안에 인라인하는 것도 허용
- `@scope/name` 형태가 실제 npm 패키지(예: `@aws-sdk/client-s3`)인 경우만 그대로 두고, `package.json`의 `dependencies`에 같이 추가

**과거 사고:**
- 2026-05-22: `spark.handler.js`가 `@interface/resultCode` 그대로 import → 부팅 실패. 해당 alias는 TS path mapping이라 ESM에서 해석 불가.

### 3-2. 새 파일이 옛 파일을 import 절대 금지 (2026-05-26 사고 룰)

같은 폴더에 옛 `<domain>.handler.js`/`<domain>.router.js`가 남아 있어도 신규 `routes.js`/`handler.js`가 그것을 import하면 안 됩니다.

```js
// ❌ 절대 금지
import { ... } from './spark.handler.js';
import { ... } from './spark.router.js';

// ✅ 허용
import { ... } from './handler.js';
```

**자동 적용 알고리즘 (PR 생성 직전 의무)**:

1. 신규로 만들거나 수정한 모든 파일에서 `from\s+['"]\./<filename>['"]` 추출
2. `<filename>`이 `<domain>.handler.js` / `<domain>.router.js` / `<domain>.Controller.js` 같은 옛 패턴인지 검사
3. 매칭되면 다음 둘 다 수행:
   - 옛 파일 본문을 신규 파일명(`handler.js` 등)으로 **rename + 이동**
   - 옛 파일을 같은 PR에서 **DELETE**
4. import 경로를 신규 파일명으로 갱신

**과거 사고**: 2026-05-26 — `src/domains/spark/routes.js`가 `./spark.handler.js`를 import. 옛 파일이 path alias(`@interface/resultCode`)를 사용해 ECS 부팅 즉시 `ERR_MODULE_NOT_FOUND`. CI/CD는 ✅, 옛 task가 살아남아 Swagger에는 `sample`만 보임. failedTasks 930회 누적.

### 3-3. Swagger glob 매칭 보장

`backend-migration/src/server.js`의 swagger-jsdoc 설정:

```js
apis: ["./src/domains/*/routes.js"]
```

**이 glob에 매칭되지 않는 라우터 파일은 Swagger UI(`/api-docs`)에 절대 노출되지 않습니다.**

자동 적용:
- 신규 도메인의 라우터 파일명은 반드시 **`routes.js`** (다른 어떤 이름도 금지)
- 라우터를 분할해서 `routes/auth.js`, `routes/admin.js` 같이 두면 glob 미매칭 — 한 파일에 통합하거나 glob을 수정 (glob 수정은 별도 PR로 의도 분리)

### 3-4. handler.js의 외부 모듈 import는 모두 실재 보장

`handler.js`가 import하는 모든 항목은 같은 PR에 **실재 파일**로 존재해야 합니다.

| 패턴 | 처리 |
|---|---|
| `./<Name>.Controller.js`, `./<Name>.Services.js` 등 origin 계열 모듈 | 본문이 마이그레이션 안 됐으면 **stub 동봉 의무** (아래) |
| `./schemas.js`, `./repository.js` 등 신규 모듈 | 같은 PR에 생성 |
| `../../middleware/<x>.js`, `../../config/<x>.js` | 없으면 pass-through stub (§ 부팅 안정성 1 참조) |
| `../../interface/<x>.js`, `../../common/<x>.js` | 없으면 동봉. path alias 사용 금지 |

**Controller/Services stub 표준 형식**:

```js
// src/domains/<domain>/<Name>.Controller.js
// TODO: porting origin <Name>.Controller + <Name>.Services
// 부팅 안정성을 위해 stub만 동봉. 실제 구현은 후속 PR.
// 응답 포맷: { resultCode, resultMsg, data } — prompts/api/_shared/response-format.md
// 비즈니스 룰: prompts/api/domains/<domain>/business-rules.md

const notImplemented = (fn) => async () => {
  const err = new Error(`<Name>.${fn} not implemented yet`);
  err.code = 'NOT_IMPLEMENTED';
  throw err;
};

export const <Name>Ctrl = {
  // handler.js가 호출하는 메서드만 stub으로 노출
  someMethod: notImplemented('someMethod'),
  ...
};
```

handler.js의 모든 `<Name>Ctrl.xxx(...)` 호출을 grep해 stub 메서드 목록 자동 생성.

### 4. PR 전 자가 점검 체크리스트

PR 생성 직전 다음을 **자동 grep으로** 모두 확인:

- [ ] `src/domains/<domain>/routes.js` 파일명 정확 (복수형, 접두/접미 없음)
- [ ] `src/domains/<domain>/handler.js` 파일명 정확 (단수형)
- [ ] 각 라우트 위에 `@swagger` JSDoc 블록 존재 (`grep -c '@swagger' routes.js >= 라우트 개수`)
- [ ] 같은 PR의 `src/server.js`에 `import <d>Router from "./domains/<d>/routes.js"` + `app.use("/<d>", <d>Router)` **두 줄 모두** 활성화 (주석 처리된 채로 두지 말 것)
- [ ] 라우터가 import하는 미들웨어/유틸의 **파일이 실제 존재**. 없으면 stub 같이 포함
- [ ] 옛 형식 파일(`<domain>.router.js`/`<domain>.handler.js`/`<domain>.Controller.js`)이 같은 폴더에 남아있지 않음 (R3, R3-2)
- [ ] 신규 파일 어디에도 옛 파일을 import하지 않음 (R3-2 grep)
- [ ] 신규 파일 어디에도 TS path alias(`@xxx/yyy`) 사용 안 함 (R3-1)
- [ ] handler.js가 import하는 `<Name>.Controller.js`/`Services.js` 파일이 실재 또는 stub 동봉됨 (R3-4)
- [ ] swagger-jsdoc glob `./src/domains/*/routes.js` 패턴에 본 PR의 라우터 파일이 매칭됨 (R3-3)

위 항목 중 하나라도 누락되면 ECS task 부팅 실패 또는 Swagger 누락이 발생합니다. 과거 실제 발생한 사고:

- 2026-05-21: `spark.router.js` 파일명 → Swagger 누락
- 2026-05-22: `entrypoint.sh`의 `node server.js` (실제는 `src/server.js`) → 부팅 실패
- 2026-05-22: `src/middleware/auth.js` 누락 → `ERR_MODULE_NOT_FOUND` 부팅 실패
- 2026-05-26: 신규 `spark/routes.js`가 옛 `./spark.handler.js`를 import → 옛 path alias로 부팅 실패. CI/CD ✅, 옛 task 유지, Swagger에 sample만 노출 (failedTasks 930회)
