# uploader 도메인 개요 (재현 스펙)

## 책임

S3 presigned 업로드 URL 발급. 클라이언트가 직접 S3로 PUT.

## 라우팅 베이스

`app.use('/uploader', uploaderRouter)`.
