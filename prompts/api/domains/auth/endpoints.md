# auth 엔드포인트 명세

## GET /auth/jwt-verify

> JWT 토큰 검증 (Authorization: Bearer <token>).

**Auth**: JWT 필수 (`verifyJWT` 미들웨어).

**검증**: 미들웨어 통과 후 `event.user` 누락 시 → `error "Invalid token"` (resultCode.error)

**Response data**
```ts
{
  valid: true,
  userid: string,
  email: string | null,
  name: string | null,
  picture: string | null
}
```

**용도**: 클라이언트가 발급된 토큰 형식이 서버에 의해 수용되는지 단순 확인. 비즈니스 호출 전 사전 점검.
