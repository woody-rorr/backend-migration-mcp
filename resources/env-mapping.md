# Lambda env → ECS env 변환 규칙

## 직접 이관 (값 그대로)

- 원본 serverless.ts `provider.environment` 또는 함수별 `environment`에 있는 키들을 그대로 ECS task-def `containerDefinitions[0].environment`로 옮긴다.

## SSM 분리

다음 키는 task-def에 평문 값으로 넣지 않고 SSM SecureString에 저장 후 entrypoint.sh가 주입:

- `DB_URL`, `DATABASE_URL`, `POSTGRES_URL`
- `JWT_SECRET`, `SESSION_SECRET`
- `*_API_KEY`, `*_SECRET`
- 외부 서비스 자격증명 일반

## 자동 주입

- `AWS_REGION` = `us-east-1`
- `NODE_ENV` = `production`
- `PORT` = `5012`

## 제거

- `IS_OFFLINE` (serverless-offline 전용)
- `_X_AMZN_TRACE_ID` 등 Lambda 런타임 변수
