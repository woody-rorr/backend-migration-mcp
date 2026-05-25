# spark 도메인 개요 (재현 스펙)

## 책임

사용자의 **spark(=exp, 경험치)** 적립·조회·취소·랭킹/퀴즈 보상 지급. 내부 다른 도메인(quiz, donation, users/login)이 호출하는 **API + 내부 서비스**의 이중 진입점을 가짐.

> 본 .md는 **HTTP API 엔드포인트**만 다룹니다. 내부 호출 전용(`earnSpark`, `revokeQuizAnswerSpark`, `grantSparkOnBoost`, `grantSparkOnLogin`)은 controller에 노출되지만 HTTP 라우트 없음.

## 핵심 모델

- `user_balance`: 사용자별 `exp`(spark), `cash`, `point` 컬럼. 행 없으면 `INSERT`, 있으면 `UPDATE exp = exp + ?`.
- `spark_user_transactions`: 모든 적립/회수 이력. `transaction_type` (`earn`/...), `source_type`, `source_id`로 멱등성 키 구성.
- `users`: `email`, `displayname`, `picture` 조회용 (read-only).
- `quiz_user_answers`, `quiz_user_streaks_monthly`: 퀴즈 참여 보상/월별 랭킹 보상 산출 read-only.

## spark 정체성

- 표시 단위: **exp** (1 spark = 1 exp). 응답 필드는 `exp`로 노출 (`spark`로 rename 금지 — 클라이언트 호환).
- 등급: `getGradeByExp(exp)` / `getGradeNameByExp(exp)` — `src/domains/spark/constants/grade.config.{js,ts}` 그대로 이식.

## 멱등성 키

`spark_user_transactions (userid, source_type, source_id)` 조합으로 중복 지급 방지. 퀴즈 참여 보상 `source_id` 포맷:

```
sourceId(matchId, gameId):
  gid = gameId trim
  return gid ? `${matchId}|${gid}` : `${matchId}|schedule`
```

- 라이브 픽: `<matchId>|<gameId>`
- 스케줄 픽: `<matchId>|schedule`

→ 매치당 1회가 아니라 **(매치, 게임)당 1회**.

## 라우팅 베이스

`app.use('/spark', sparkRouter)`.

## 인증

| 엔드포인트 | JWT |
|---|---|
| GET /spark/profile | 필수 |
| GET /spark/transactions | 필수 |
| GET /spark/summary | 미적용 (어차피 "not implemented") |
| POST /spark/rewards/quiz-participation | 필수 (단 body의 userid는 무시, JWT에서 추출) |
| POST /spark/rewards/ranking/process-monthly | **없음** (관리자용, 외부 보호 의무) |

## 도메인 경계

- read-only: `users`, `quiz_user_answers`, `quiz_user_streaks_monthly`, `matches`
- write: `user_balance`, `spark_user_transactions` 만
- 외부 서비스: `MSGBoxesServices.selectNewMessageCount` (쪽지 카운트) — 실패 시 0으로 fallback
