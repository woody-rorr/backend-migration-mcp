# payment 도메인 비즈니스 규칙

## R1. alramPaymenetPG 응답 포맷 예외

이 한 엔드포인트만 `formatJSONResponseForXsolla` 사용. Xsolla가 기대하는 특정 포맷(통상 `{ status: "ok" }` 또는 빈 200) 응답. 마이그레이션 시:
- `src/common/xsolla-response.js`로 origin 함수 옮김
- 표준 `ok()` 헬퍼 사용 금지

## R2. alramPaymenetPG는 event 전체 전달

다른 엔드포인트는 `event.body`만 전달하지만 이건 전체. 헤더의 서명/timestamp 검증 등에 필요.

ECS Express에서는 `event` 객체가 없으므로 `req` 그대로 전달:
```js
router.post('/alramPaymenetPG', async (req, res, next) => {
  try {
    const ret = await paymentContrl.alramPGPaymnet(req);  // req 전체
    return res.json(xsollaFormat(ret));
  } catch (e) { next(e); }
});
```

## R3. confirmPaymentByToss schema 제거

origin 주석: "request 스키마 제거 — API Gateway 모델 생성 취소 에러 회피. 핸들러에서 검증 유지".

마이그레이션:
- 라우터 단에서 zod 검증 안 함
- service `confirmPaymentByToss` 내부에서 origin 그대로 검증

## R4. 멱등성

PG 콜백은 동일 거래에 대해 여러 번 호출될 수 있음 (Xsolla/Toss 재시도). service는 transaction_id 기준 멱등성 보장. 중복 콜백 시 그냥 200 + `{ status: "ok" }`.

## R5. 결제 후 spark/balance 적립

결제 성공 시 user_balance.cash 또는 .exp 증가는 service 내부에서 처리. spark 도메인의 `grantSpark*` 호출 가능. 트랜잭션은 service 단에서 묶음.

## R6. 응답에서 PG 키/토큰 누출 금지

origin에서 Xsolla/Toss access key 등이 응답에 포함되지 않는지 확인. 마이그레이션 시도 동일 유지.

## R7. 서비스 이식

`paymentContrl.*` 4개 함수 + `Payment.Services` 1:1. Xsolla/Toss SDK 호출은 `src/clients/`로 격리.
