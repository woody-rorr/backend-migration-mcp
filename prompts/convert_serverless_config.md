# serverless.ts/yml → Route Inventory 추출

## 추출 대상

`functions:` 또는 `functions = {...}` 블록에서 각 함수의 `events: [{ http: {...} }]` 또는 `events: [{ httpApi: {...} }]`를 라우트로 변환.

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
