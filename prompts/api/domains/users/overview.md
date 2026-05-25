# users 도메인 개요 (재현 스펙)

## 책임

사용자 인증(로그인), 본인 정보 조회, 잔액/입금 이력 조회. Google OAuth 기반.

## 라우팅 베이스

`app.use('/users', usersRouter)`.

## 외부 의존

- Google OAuth (`ExternalServices/GoogleAPI`) — `src/clients/google.js`로 격리
- spark 도메인의 `grantSparkOnLogin` — 로그인 성공 시 호출
