# payment 도메인 개요 (재현 스펙)

## 책임

결제 처리 — Xsolla(글로벌 PG)와 Toss(국내 PG) 두 게이트웨이 지원. UI 토큰 발급, 트랜잭션 ID 발급, 결제 콜백 처리.

## 라우팅 베이스

`app.use('/payments', paymentRouter)` — path 원본 그대로.

## 외부 의존

- Xsolla API (`paymentContrl.getPGAccessToken`, `alramPGPaymnet`)
- Toss API (`confirmPaymentByToss`)

마이그레이션 시 `src/clients/xsolla.js`, `src/clients/toss.js`로 격리. API 키는 SSM.

## 응답 포맷 예외

`alramPaymenetPG`는 **`formatJSONResponseForXsolla`** 사용 (Xsolla 콜백 호환). 다른 엔드포인트는 표준 `formatJSONResponse2`.
