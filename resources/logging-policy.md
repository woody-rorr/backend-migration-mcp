# 로깅 정책

## 출력 채널

- ECS Fargate는 stdout/stderr → CloudWatch Logs (`/ecs/<service-name>` 로그 그룹).
- 별도 로그 파일 작성 금지.

## 라이브러리

- 원본이 `console.log`만 쓰면 그대로 유지 (변환 비용 최소화).
- 구조화 로깅 필요 시 `pino` 권장 (JSON 출력, 저오버헤드).

## 요청 로깅

- `morgan` 또는 `pino-http`를 app-level 미들웨어로 한 줄 추가.
- format: `method url status response-time-ms`.

## 민감정보 마스킹

- Authorization 헤더, password, token 류는 로그에 직접 출력 금지.
- 에러 스택은 그대로 출력 OK (CloudWatch 접근 제한 가정).
