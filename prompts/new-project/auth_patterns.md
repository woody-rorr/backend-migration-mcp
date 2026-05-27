# Auth Patterns — 회원가입/로그인/JWT

> `scaffold_new_project_api`가 auth 관련 코드를 생성할 때 따르는 규약.

## 1. 비밀번호
- **해싱**: `bcrypt` (salt rounds=10). 절대 평문 저장 금지.
- DB 컬럼명: `password_hash` (snake_case), entity 필드: `passwordHash`.
- 비번 정책 (DTO `@MinLength(8) @Matches(/...)`):
  - 최소 8자
  - 영문 + 숫자 1자 이상 포함 권장 (필수는 도메인 상황에 따라)
- 응답 DTO에서 `passwordHash` 절대 노출 금지 (`@Exclude()` 또는 별도 ResponseDto 사용).

## 2. JWT
- 알고리즘: **HS256** (기본). 운영 규모 커지면 RS256 검토.
- Secret: env `JWT_SECRET` (SSM SecureString, 최소 32자 random).
- 만료: env `JWT_EXPIRES_IN` (기본 `1h`).
- Payload 스키마:
  ```ts
  {
    sub: string;     // user.id (uuid)
    email: string;
    roles: string[]; // 빈 배열이라도 항상 존재
    iat: number;
    exp: number;
  }
  ```
- Refresh token: **기본 미사용** (단순화). 필요 시 별도 명세로 추가.

## 3. Signup 흐름
- 엔드포인트: `POST /api/auth/signup`
- 요청: `Create<User>Dto` (email, password, name)
- 처리 순서:
  1. email 중복 체크 (`409 CONFLICT { code: "EMAIL_EXISTS" }`)
  2. bcrypt 해싱 (rounds 10, await)
  3. user insert (트랜잭션 안에서)
  4. JWT 발급 즉시 응답 (`201 { accessToken, user }`)
- 응답 user 객체: id, email, name, createdAt만. passwordHash 제외.

## 4. Login 흐름
- 엔드포인트: `POST /api/auth/login`
- 요청: `{ email, password }`
- 처리 순서:
  1. user 조회 (`select id, email, passwordHash, name`)
  2. 존재 여부 + bcrypt.compare → 둘 중 하나라도 실패 시 **동일한 401** 반환 (`{ code: "INVALID_CREDENTIALS" }`)
     - 두 케이스 메시지 다르게 주면 enumeration 공격 가능.
  3. 성공 시 JWT 발급 → `200 { accessToken, user }`

## 5. Guard 적용
- 전역 guard 사용하지 않음. `JwtAuthGuard`를 controller/메서드에 명시.
- 공개 엔드포인트는 `@Public()` 데코레이터 표기 (현 시점에는 health, signup, login).
- `req.user`는 `JwtPayload` 타입.

## 6. 금지 사항
- `JWT_SECRET` 코드에 하드코딩 금지.
- 비번을 로그에 출력 금지 (LoggingInterceptor에서 자동 마스킹).
- `passwordHash` 응답/로그 노출 금지.
- 토큰을 URL query에 담아 발급 금지 (Authorization 헤더 또는 응답 body만).
