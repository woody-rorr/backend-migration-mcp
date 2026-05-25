# auth 도메인 개요 (재현 스펙)

## 책임

JWT 토큰 검증 진입점. 토큰 형식/유효성 테스트용 단일 엔드포인트.

## 라우팅 베이스

`app.use('/auth', authRouter)`.

## JWT 미들웨어

`verifyJWT` 미들웨어 (다른 도메인이 모두 의존). 마이그레이션 시:
- `src/middleware/auth.js`에 `authRequired` / `authOptional` 명칭으로 노출
- 토큰 디코딩 결과를 `req.user = { id, email, name, picture, ... }`에 주입
- 실패 시 `validationError "Invalid token"` (혹은 401)
