# systemMsg 도메인 개요 (재현 스펙)

## 책임

외부 webhook(Teams 등)으로 시스템 알림 발송. 본 API는 webhook adapter 역할만, 메시지 저장은 안 함.

## 라우팅 베이스

`app.use('/webHooks', systemMsgRouter)` — path 원본 그대로 `/webHooks/sendSystemMsg`.

## 외부 의존

`TeamsWebhooksCtrl.sendNotification` — `src/clients/teams-webhook.js`로 분리.
