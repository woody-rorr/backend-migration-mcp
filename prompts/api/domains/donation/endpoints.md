# donation 엔드포인트 명세

전체 POST. schema는 origin `donation/schema.ts` 그대로.

## 1. POST /donation/setDonation

> 후원 등록 (origin handler 주석 처리됨 — **현재 비활성**).

origin index.ts에는 라우트 존재하지만 handler.ts에서 `_setDonation` 주석 처리. 마이그레이션 시:
- 라우트 mount 안 함
- 또는 mount하되 501 응답
- 별도 결정 시 활성화

## 2. POST /donation/getDonationHistoryByUser
- **Auth**: JWT 필수
- **Body** (`schemaUserDonationHistoryByUser`): userid, 기간/페이지
- **처리**: `DonationCtrl.getDonationHistoryByUser(body)`
- **Response**: `null` (origin `IResult<null>` — 실제로는 데이터 들어있을 가능성, origin DTO 그대로 따름)

## 3. POST /donation/getDonationHistoryByPlayer
- **Auth**: JWT 필수
- **Body** (`schemaUserDonationHistoryByPlayer`)
- **처리**: `DonationCtrl.getDonationHistoryByPlayer(body)`

## 4. POST /donation/getDonationHistoryByMatch
- **Auth**: JWT 필수
- **Body** (`schemaUserDonationHistoryByMatch`)
- **처리**: `DonationCtrl.getDonationHistoryByMatch(body)`

## 5. POST /donation/getDonationHistoryByTeam
- **Auth**: JWT 필수
- **Body** (`schemaUserDonationHistoryByTeam`)
- **처리**: `DonationCtrl.getDonationHistoryByTeam(body)`

## 6. POST /donation/getBoostWall
- **Auth**: JWT 필수
- **Body** (`schemaGetBoostWall`)
- **처리**: `DonationCtrl.getBoostWall(body)` → `IResponseGetBoostWall`
- 부스트 현황 벽(인기 선수/팀별 합계 등)

## 7. POST /donation/setLikePlayer
- **Auth**: **없음** (origin handler에 verifyJWT 미적용)
- **Body** (`schemaLikePlayer`): userid, player_id, like_yn
- **처리**: `DonationCtrl.setLikePlayer(body)` → `null`

## 8. POST /donation/setBoostPlayer
- **Auth**: JWT 필수
- **Body** (`schemaBoostPlayer`): userid, match_id, target_type, target_id, amount, master_transaction_code 등
- **처리**: `DonationCtrl.setBoostPlayer(body)`
- **Response data**:
  ```ts
  {
    match_id: string,
    target_type: string,           // 'player' | 'team'
    target_id: string,
    amount: number,                // 차감된 cash
    master_transaction_code: string | null,
    spark_granted: number          // 부스트 보상 spark
  } | null
  ```
- **Side effect**: 성공 시 `SparkCtrl.grantSparkOnBoost(userid, 'live_match', match_id, game_id)` 호출

## 9. POST /donation/setBoostPlayerForSchedules
- **Auth**: JWT 필수
- **Body** (`schemaBoostPlayer`)
- **처리**: `DonationCtrl.setBoostPlayerBySchedule(body)`
- 동일 응답 구조. boost_type = `'pre_match'`.

## Swagger 주의

각 엔드포인트에 `tags: [donation]` + 정확한 schema 매핑 JSDoc 필수.
