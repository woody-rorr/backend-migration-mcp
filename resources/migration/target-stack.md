# 마이그레이션 타겟 스택

## 런타임

- Node.js 20 + Express 4
- ESM (`"type": "module"`)
- TypeScript는 사용하지 않음 (원본이 TS여도 빌드 후 JS 산출물로 컨버전)

## 폴더 구조

```
backend-migration/
├── src/
│   ├── server.js              # express app + listen
│   ├── routes/                # Express Router들
│   ├── handlers/              # 원본 Lambda 핸들러 로직 (재사용)
│   ├── middleware/            # cors, auth, errorHandler
│   ├── config/                # env, db pool 초기화
│   └── libs/                  # AWS SDK 래퍼 등
├── deploy/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── task-definition.json
└── package.json
```

## 부팅 순서

1. `src/config/env.js` — 환경변수 검증 (zod)
2. `src/config/db.js` — DB pool 초기화
3. `src/server.js` — Express app 구성 + listen(5012)

## 시크릿 관리

- DB URL, 외부 API key 등은 AWS SSM Parameter Store에 저장
- `deploy/entrypoint.sh`가 부팅 시 SSM에서 가져와 env로 주입
- 코드에서 `process.env.X`로 읽음 (Lambda와 동일 인터페이스 유지)
