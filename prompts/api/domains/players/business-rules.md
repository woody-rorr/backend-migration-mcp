# players 도메인 비즈니스 규칙

## R1. JWT 필수지만 권한 분기 없음

origin은 JWT 토큰만 확인, admin role 체크 없음. 마이그레이션 시 동일 유지 — 관리자 보호는 ALB/IP 화이트리스트로.

## R2. upsert 시멘틱

선수 id 기준 존재하면 UPDATE, 없으면 INSERT. 정확한 컬럼 매핑은 `Player.Services.setPlayerInfo` 그대로.

## R3. 멱등성

동일 body 재호출 시 결과 동일. 새 컬럼/행 추가 없음.

## R4. 서비스 이식

`PlayerCtrl.setPlayerInfo` + `Player.Services` 1:1.
