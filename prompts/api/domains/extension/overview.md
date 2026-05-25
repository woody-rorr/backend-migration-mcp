# extension 도메인 개요 (재현 스펙)

## 책임

Live2D 캐릭터(웹 익스텐션) 자산 메타데이터/업로드 처리. 캐릭터별 manifest 보관, S3 presigned upload URL 발급.

## 라우팅 베이스

`app.use('/extension', extensionRouter)`.

## 두 가지 모드

| 호출 | 인증 | 동작 |
|---|---|---|
| `GET ?character_name=seoha` | 없음 | 공개 캐릭터 manifest (DB 또는 정적 기본값) |
| `GET` (파라미터 없음) | 없음 | anonymous 기본 캐릭터 |
| `POST` | JWT 필수 | 캐릭터 upsert + presigned URL 발급 |
