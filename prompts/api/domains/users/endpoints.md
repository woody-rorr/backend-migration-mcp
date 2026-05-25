# users 엔드포인트 명세

## 1. POST /users/login

> Google OAuth 로그인.

**Auth**: 없음 (이 엔드포인트가 토큰 발급).

**Header**: `origin` — `returnURL = "${origin}/auth-verification"` 구성에 사용.

**Body** (`schemaAuthentification`)
- Google OAuth code / token 등

**처리**: `UsersCtrl.login(body, returnURL)` → `IGoogleUser`

**Response data**
- 사용자 정보 + JWT (origin DTO 그대로)

**Side effect**: 로그인 성공 시 `SparkCtrl.grantSparkOnLogin(userid)` 호출됨 (origin 그대로). 일일 1회 멱등.

---

## 2. GET /users/me

> 본인 정보 (`follow_onboarding_yn` 포함).

**Auth**: JWT 필수.

**처리**: `UsersCtrl.getMe(req.user)` — JWT 페이로드 그대로 전달

**Response data** (origin DTO)
- userid, email, displayname, picture, follow_onboarding_yn 등

---

## 3. POST /users/getUserBalance

> 잔액 조회.

**Auth**: JWT 필수.

**Body** (`schemaGetUserBalance`)
- userid

**처리**: `UsersCtrl.getUserBalance(body)`

**Response data** (`IResponseGetUserBalance`)
- exp, cash, point 등

> 참고: spark/profile과 응답 구조 유사하지만 별도 엔드포인트. 마이그레이션도 분리 유지.

---

## 4. POST /users/getUserDepositHistory

> 입금/적립 이력.

**Auth**: JWT 필수.

**Body** (`schemaGetUserDepositHistory`)
- userid, 페이지/기간 필터

**처리**: `UsersCtrl.getUserDepositHistory(body)`
