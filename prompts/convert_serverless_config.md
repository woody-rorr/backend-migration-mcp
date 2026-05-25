# serverless.ts/yml → Route Inventory 추출

## ⚠️ 실제 원본 레포(`backend-lol-api-v3`) 구조 주의

**`serverless.ts` 안에는 path가 없습니다.** path는 `src/functions/<domain>/index.ts`에 도메인별로 분산되어 있습니다.

### 패턴 A — 분산형 (현 원본 레포)

```ts
// serverless.ts
import serverlessConfiguration from './...';
export default {
  // ...
  functions: (() => {
    // IIFE로 src/functions/<domain>/index.ts 들을 동적으로 합침
    return { ...sparkFns, ...followFns, ...quizFns, ... };
  })(),
};
```

```ts
// src/functions/<domain>/index.ts  ← ⭐ 여기에 실제 path 정의됨
export const getProfile = {
  handler: `${handlerPath(__dirname)}/handler.getProfileHandler`,
  events: [{ http: { method: 'get', path: 'spark/profile', cors } }],
};
export const getTransactions = { handler: ..., events: [{ http: { method: 'get', path: 'spark/transactions' } }] };
// ...
```

**도메인 X 마이그레이션 시 추출 절차:**

1. github MCP로 `src/functions/<X>/index.ts` (또는 `src/functions/<X>/*.ts` 전체) 읽기
2. 파일 안의 모든 `export const <name> = { handler, events: [...] }` 식별
3. 각 export의 `events[].http` (또는 `events[].httpApi`)에서 `method` + `path` 추출
4. `handler` 문자열의 `${handlerPath(__dirname)}/handler.<fnName>` → 실제 위치 `src/functions/<X>/handler.ts`의 `<fnName>` export
5. (선택) 같은 도메인 디렉토리의 `<X>.Controller.ts`, `<X>.DB.Service.ts` 등 보조 파일도 함께 읽어서 의존성 파악

### 패턴 B — 단일 파일형 (일반적 serverless 프로젝트)

```yaml
# serverless.yml
functions:
  getMatch:
    handler: src/handlers/match.getMatch
    events:
      - http:
          method: GET
          path: /matches/{matchId}
```

또는

```ts
// serverless.ts
functions: {
  getMatch: { handler: '...', events: [{ http: { method: 'GET', path: '/matches/{matchId}' } }] }
}
```

이 경우 `serverless.ts/yml` 한 파일만 보면 됨.

### 어느 패턴인지 자동 판별

먼저 `serverless.ts`에서 `functions:` 값이 객체 리터럴이면 → 패턴 B, IIFE/spread/import면 → 패턴 A.

## 추출 대상 (패턴 무관 공통)

각 함수의 `events: [{ http: {...} }]` 또는 `events: [{ httpApi: {...} }]`를 라우트로 변환.

## 출력 스키마

```json
{
  "routes": [
    {
      "name": "getMatch",
      "handler": "src/functions/match.getMatch",
      "method": "GET",
      "path": "/matches/{matchId}",
      "auth": "jwt" 
    }
  ]
}
```

## 변환 규칙

- API Gateway path parameter `{matchId}` → Express `:matchId`
- `method`는 항상 대문자 (GET/POST/PUT/DELETE/PATCH).
- `auth`는 `authorizer` 또는 `private: true` 존재 여부로 결정. 없으면 `null`.
- 비-HTTP 이벤트(`schedule`, `sqs`, `s3`, `dynamodb` 등)는 별도 `workers` 배열로 분리.

## 무시할 항목

- `vpc`, `iamRoleStatements`, `environment` 등 인프라 설정은 ECS task-def로 별도 이관 — route inventory에는 포함하지 않음.
