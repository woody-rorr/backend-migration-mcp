# mainfeed 도메인 비즈니스 규칙

## R1. 인증 없음 (origin 호환)

origin에서 JWT 적용 안 함 → 마이그레이션도 동일. 변경 시 클라이언트 깨질 수 있음.

## R2. 좋아요 멱등성

`like_yn`이 같은 값으로 두 번 호출되어도 결과 동일. 카운터는 origin SQL의 트랜잭션 그대로.

## R3. 응답 구조

`IResponseFeed`, `IResponseSetFeedLike` 필드명/타입 변경 금지.

## R4. 서비스 이식

`Mainfeed.Controller.getFeeds` / `setFeedLike` + `Mainfeed.Services` 1:1.
