# auth 도메인 비즈니스 규칙

## R1. 응답 picture는 JWT의 payload 그대로

DB 조회 없이 토큰 디코딩 결과만 반환. spark/profile은 DB의 picture를 fallback 사용하지만 본 엔드포인트는 JWT 단독.

## R2. 토큰 외 검증 없음

만료/서명만 미들웨어가 검증. 사용자 상태(차단/탈퇴 등)는 본 엔드포인트에서 확인하지 않음.

## R3. resultCode

- 미들웨어 실패 → 미들웨어가 응답 형성 (이 도메인 코드 안 탐)
- `event.user` 미존재 → `error "Invalid token"`
- 정상 → `Success "Valid token"`

## R4. 토큰 디코딩 일관성

마이그레이션 후 `verifyJWT`는 다른 도메인에서도 동일하게 사용 — payload 구조를 통일 (`{ id, email, name, picture, ... }`). 변경 시 모든 도메인 영향.
