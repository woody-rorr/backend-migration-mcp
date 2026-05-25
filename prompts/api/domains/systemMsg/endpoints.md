# systemMsg 엔드포인트 명세

## POST /webHooks/sendSystemMsg

> Teams webhook으로 시스템 메시지 발송.

**Auth**: 없음. **외부 보호 의무** (API Gateway/WAF/IP 화이트리스트).

**Body** (`schemaSendSystemMsg` — origin 그대로)
- 메시지 본문/제목/심각도 등

**처리**: `TeamsWebhooksCtrl.sendNotification(body)`

**Response data**
- 성공 시 `null` (origin `IResult<null>`)
- 실패 시 `resultCode.error`
