# donation 도메인 개요 (재현 스펙)

## 책임

선수/팀 후원("부스트") + 좋아요. 결제(payment 도메인)로 충전된 cash를 spark 형태로 변환·소비. 부스트 성공 시 spark 지급(`SparkCtrl.grantSparkOnBoost`).

## 라우팅 베이스

`app.use('/donation', donationRouter)`.

## 두 가지 부스트 모드

| 모드 | 엔드포인트 | 시점 |
|---|---|---|
| live_match | `setBoostPlayer` | 경기 중. `match_id` + `game_id` 필수 |
| pre_match | `setBoostPlayerForSchedules` | 경기 전 (스케줄). `match_id`만 |

spark 도메인의 `grantSparkOnBoost(userid, boost_type, match_id, game_id?)`와 매핑.

## 멱등성

- 후원/부스트는 **금전 동작** → 멱등성 키(`master_transaction_code`)로 중복 방지
- 같은 transaction code 재호출 시 신규 적용 없음, 응답은 기존 결과
