# ranking 도메인 비즈니스 규칙

## R1. limit 상한 500

`getMonthlyRanking`의 limit은 1~500. 그 외 검증 실패. origin 그대로.

## R2. current_userid 전달

`getMonthlyRanking`에 JWT userid를 항상 같이 전달 → 응답에 본인 랭킹 위치 동봉. service가 본인 행을 별도 키(`me` 등)로 반환.

## R3. period_value 미지정 시

서비스가 가장 최근 month 자동 선택. (`quiz_user_streaks_monthly`의 최신 period_value)

## R4. path userid 우선

`/ranking/monthly/user/:userid`로 path에 명시되면 그것이 우선. 없으면 JWT의 userid.

## R5. 사용자 미존재

`quiz_user_streaks_monthly`에 해당 (userid, period) 없으면 origin 서비스 반환 따라 — 통상 `null` 또는 `{ rank: null, ... }`. 본 도메인에서 별도 404 처리 안 함.

## R6. 서비스 이식

`Ranking.Controller.*` + `Ranking.Services` 1:1. SQL의 `RANK() OVER (...)` 쿼리는 origin 그대로 유지.
