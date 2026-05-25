# uploader 엔드포인트 명세

## POST /uploader/getOnetimeURL

> S3 업로드용 일회성 presigned URL 발급.

**Auth**: **없음** (origin에서 verifyJWT 주석 처리). 마이그레이션 시 동일 유지 — 외부 호출 차단은 ALB 단에서.

**Body** (`schemaGetOnetimeURL` — origin)
- `bucket`, `key` (또는 카테고리/파일명), `content_type` 등

**처리**: `UploaderCtrl.getOnetimeURL(body)`

**Response data**
- presigned URL, key, expires 등 (origin DTO 그대로)

## 비고

원본 주석 처리된 `setUploadCompleted`는 라우트 생성 금지. 별도 결정 시 신규 PR.
