# users 도메인 비즈니스 규칙

## R1. returnURL 구성

```
baseURL = req.headers.origin
returnURL = `${baseURL}/auth-verification`
```

origin 주석된 host/protocol 대체 로직은 사용 안 함 (`event.headers.origin`만). 마이그레이션:
```js
const baseURL = req.get('origin');
const returnURL = `${baseURL}/auth-verification`;
```

origin 헤더 누락 시 returnURL이 `undefined/auth-verification`이 되므로 Google OAuth flow가 실패. 클라이언트가 origin 헤더를 정확히 보내야 함.

## R2. 로그인 시 spark 지급

origin은 `UsersCtrl.login` 내부에서 `SparkCtrl.grantSparkOnLogin(userid)` 호출. 마이그레이션 시 동일:
- 일일 1회 멱등 (`source_type='login_daily'`, `source_id=YYYY-MM-DD KST`)
- spark service의 트랜잭션 안에서 처리 — users service는 단순히 호출만

## R3. JWT 발급/검증 일관성

- `login` 응답의 JWT는 다른 도메인 모든 JWT 미들웨어와 호환되어야 함
- payload: `{ id, email, name, picture, exp(만료), iat }` — 변경 금지

## R4. getMe는 JWT 페이로드 + DB 조회

JWT 정보 + `users` 테이블의 `follow_onboarding_yn` 등 동적 정보 join 후 반환. 단순 토큰 디코딩보다 1단계 더.

## R5. getUserBalance vs spark/profile

둘 다 잔액 반환하지만:
- `getUserBalance`: 잔액만 (가벼움)
- `spark/profile`: 잔액 + 등급 + 쪽지 카운트 + 프로필 이미지 (무거움)

각 응답 DTO 분리 유지.

## R6. body의 userid vs JWT userid

`getUserBalance` / `getUserDepositHistory`: body의 userid가 JWT의 id와 다르면 service에서 ForbiddenError throw 권장. origin은 검사 안 함 — 마이그레이션 시 보안 강화 권장하나 origin 호환 유지.

## R7. 서비스 이식

`UsersCtrl.*` 4개 함수 + `Users.Services` 1:1. Google OAuth flow는 `src/clients/google.js`로 격리.
