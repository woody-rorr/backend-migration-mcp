# version 도메인 비즈니스 규칙

## R1. 인증 없음

공개 엔드포인트. 부트스트랩 단계에서 호출됨 (JWT 발급 전).

## R2. 응답 구조 고정

`IResponseVersionInfo` 필드 변경 금지 — 클라이언트가 키로 분기.

## R3. 서비스 이식

`Version.Controller.getVersionInfo` + `Version.Services` 1:1 이식.
