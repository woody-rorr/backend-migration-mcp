# payment 엔드포인트 명세

## 1. POST /payments/getXsollaUIToken

> Xsolla UI 토큰 발급.

**Auth**: JWT 필수.

**Body** (`schemaGetXsollaUIToken`)
- 상품/금액 정보

**처리**: `paymentContrl.getPGAccessToken(body)` → `IGoogleUser` 타입(origin 그대로) — 실질적으로 token 응답.

---

## 2. POST /payments/alramPaymenetPG

> Xsolla 결제 콜백 (PG → 서버).

**Auth**: **없음**. Xsolla IP 화이트리스트로 보호.

**Body**: Xsolla 표준 webhook payload (검증 schema 없음 — origin은 `event` 통째로 전달)

**처리**: `paymentContrl.alramPGPaymnet(event)` — `event` 객체 전체 전달 (헤더/메타 활용)

**Response**: `formatJSONResponseForXsolla(ret)` — **Xsolla 전용 포맷**. 표준 `{resultCode, ...}` 아님. origin 그대로.

## 3. POST /payments/getTransactionID

> 결제 트랜잭션 ID 발급.

**Auth**: JWT 필수.

**Body** (`schemaGetTransactionID`)

**처리**: `paymentContrl.getTransactionID(body)`

---

## 4. POST /payments/confirmPaymentByToss

> Toss 결제 confirm.

**Auth**: JWT 필수.

**Body**: `schemaConfirmPaymentByToss` — **하지만 origin은 API Gateway에서 schema 제거**. 핸들러/서비스 내부 검증 유지. 마이그레이션도 동일 (라우트에서 zod 검증 안 하고 service에서).

**처리**: `paymentContrl.confirmPaymentByToss(body)`

## 보안

`alramPaymenetPG`는 외부에서 호출 가능. Xsolla 공식 IP 대역만 허용 (ALB rule). PR description에 명시.
