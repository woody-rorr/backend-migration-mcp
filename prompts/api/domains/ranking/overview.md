# ranking 도메인 개요 (재현 스펙)

## 책임

월별 퀴즈 스트릭 랭킹 조회. `quiz_user_streaks_monthly` 기반 page 단위 조회.

## 라우팅 베이스

`app.use('/ranking', rankingRouter)`.

## 데이터 소스 (read-only)

- `quiz_user_streaks_monthly` — period_value(YYYY-MM)별 사용자 누적 W/L
- `users` — displayname/picture join (원본 service에서)
