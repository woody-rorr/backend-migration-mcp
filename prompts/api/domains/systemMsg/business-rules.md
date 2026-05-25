# systemMsg 도메인 비즈니스 규칙

## R1. 인증 없음

공개 엔드포인트지만 사내용. 외부에서 절대 호출되지 않도록 ALB/API Gateway에서 차단.

## R2. 본문 저장 안 함

DB 기록 없음. webhook 호출 결과만 응답.

## R3. webhook 실패 처리

`TeamsWebhooksCtrl.sendNotification` 내부에서 실패 시 throw → `resultCode.error` + 메시지. 재시도는 호출 측이 책임.

## R4. 서비스 이식

`TeamsWebhooksCtrl.sendNotification` 그대로 이식. webhook URL은 환경변수 / SSM에서 주입.
