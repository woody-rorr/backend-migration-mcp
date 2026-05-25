# donation 도메인 비즈니스 규칙

## R1. master_transaction_code 멱등성

`setBoostPlayer` / `setBoostPlayerForSchedules`의 핵심 멱등성 키.
- 같은 code로 두 번 호출 시: 첫 호출만 적용. 두 번째는 기존 결과 그대로 반환 (cash 재차감 금지)
- code가 null이면 멱등성 불가능 → service에서 에러 또는 fresh 처리 (origin 정확 동작 따름)

## R2. cash 차감 + spark 지급 트랜잭션

```
BEGIN
  master_transaction_code 중복 체크 → 중복이면 기존 row 반환하고 끝
  user_balance.cash >= amount 체크 (없으면 INSUFFICIENT_CASH)
  user_balance.cash -= amount
  donation_history INSERT (master_transaction_code 포함)
  -- spark 지급은 트랜잭션 밖? 또는 같은 트랜잭션?
COMMIT
SparkCtrl.grantSparkOnBoost(...) -- spark 도메인이 자체 트랜잭션
```

origin이 트랜잭션 경계를 어떻게 잡았는지 service 본문 그대로 이식 — 임의 변경 금지.

## R3. spark 지급 부스트 종류 매핑

| API | boost_type | spark 호출 |
|---|---|---|
| setBoostPlayer | `live_match` | `grantSparkOnBoost(userid, 'live_match', match_id, game_id)` |
| setBoostPlayerForSchedules | `pre_match` | `grantSparkOnBoost(userid, 'pre_match', match_id)` |

spark `source_id` 포맷은 spark `business-rules.md` R2 표 참조.

## R4. setLikePlayer JWT 없음

origin handler에 `verifyJWT` 안 붙음. body의 userid 신뢰. **권한 우회 위험** — PR description에 "auth 강화 TODO" 명시. 마이그레이션 호환을 위해 현 시점 verifyJWT 적용 금지.

## R5. setDonation 비활성

origin handler에서 `_setDonation` 주석 처리. 마이그레이션:
- 라우트 mount 안 함 (또는 stub mount + 501)
- 본 .md에 비활성 상태 기록

신규 활성화는 별도 PR + 본 룰 갱신.

## R6. target_type 화이트리스트

`'player'` / `'team'` 만 허용. 그 외 값은 schema 단에서 차단 또는 service에서 throw.

## R7. amount 양수 강제

`amount > 0` 검증 의무. 0 또는 음수는 `INVALID_INPUT`.

## R8. getBoostWall 정렬

응답 항목은 부스트 합계 내림차순. origin SQL 그대로 (`ORDER BY sum_amount DESC`).

## R9. getDonationHistory* 응답

origin handler는 `IResult<null>` 타입이지만 실제 data에는 배열이 들어감. 마이그레이션 시 service 반환을 그대로 `data`로. 타입 선언과 실제 데이터 불일치는 origin 그대로 유지 (클라이언트는 data 사용).

## R10. 서비스 이식

`DonationCtrl.*` 함수 7개 + `Donation.Services` 1:1.

활성 함수:
- `getDonationHistoryByUser`
- `getDonationHistoryByPlayer`
- `getDonationHistoryByMatch`
- `getDonationHistoryByTeam`
- `getBoostWall`
- `setLikePlayer`
- `setBoostPlayer`
- `setBoostPlayerBySchedule`

비활성:
- `setDonationInfo` (주석)
- `getDonationScore` (주석)
