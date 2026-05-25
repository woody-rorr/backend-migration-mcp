# uploader 도메인 비즈니스 규칙

## R1. 인증 없음 (origin 그대로)

verifyJWT 적용 안 함. 외부 노출 시 무차별 발급 위험 → ALB/API Gateway 인증/허용 IP/Rate limit 의무.

## R2. presigned URL TTL

origin `Uploader.Services` 내부 상수. 변경 금지 (클라이언트가 만료 시간 가정).

## R3. bucket / key 검증

origin schema의 정규식/길이 제약 그대로. 임의 path traversal 차단.

## R4. 서비스 이식

`UploaderCtrl.getOnetimeURL` + `Uploader.Services` 1:1. AWS SDK 호출은 `src/clients/s3.js`로 격리.
