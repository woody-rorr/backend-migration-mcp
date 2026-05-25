# quiz 도메인 비즈니스 규칙 (결정론)

> 본 .md는 HTTP API 7개 범위. MSK/소켓 룰은 별도(`quiz-realtime`) 도메인 .md로.

## R1. ID 정규화 (절대)

JSON 숫자가 큰 값에서 IEEE-754 손실 발생 → API 경계에서 **항상 문자열**로 변환.

```
normalizeQuizId(v):
  v == null → ''
  return String(v).trim()

optionalQuizGameId(v):
  v == null || v === '' → undefined
  s = String(v).trim()
  return s === '' ? undefined : s
```

- `match_id`는 빈문자열이면 검증 실패
- `game_id`는 빈/누락 = "스케줄 픽" 의미. 명시적 null vs undefined 구분 없음.

## R2. PUT /quiz/answer 액션 매트릭스

| 기존 행 | action | selected_team_id | 결과 | DB 동작 |
|---|---|---|---|---|
| 없음 | `submit` (default) | string | `submitted` | INSERT (action='submit', selected_team_id) |
| 있음 | `submit` | string | `updated` | UPDATE (selected_team_id, action='submit', updated_date=NOW) |
| 있음 | `cancel` | (무시) | `canceled` | UPDATE (selected_team_id=NULL, action='cancel') 또는 DELETE (서비스 구현 따라) — origin 코드와 정확히 동일하게 |
| 없음 | `cancel` | (무시) | `canceled` (noop) | INSERT 또는 noop — origin과 동일 |

**추가 룰**:
- 라이브 픽이고 `match_game_live_quiz.live_quiz_open != 'Y'` 인 게임 → `LIVE_QUIZ_NOT_OPEN` 에러 (코드명 origin 정확히 매칭)
- 매치가 이미 `status='completed'` → `MATCH_CLOSED` 또는 동등 에러
- 스케줄 픽인데 매치 시작 시간 지남 → `PICK_LOCKED`

정확한 에러 코드명/시점은 `Quiz.Services.ts` 원본 함수 `upsertOrCancelMyPick`을 그대로 이식 — 변형 금지.

## R3. Spark 연동 (라이브 픽만)

- **제출/수정** (`submit`, 라이브 = `game_id` 있음, 정답 검증 전 단계): `SparkCtrl.rewardQuizParticipation({ userid, match_id, game_id })` 호출 → `spark_granted` 응답
- **취소** (`cancel`, 라이브): `SparkCtrl.revokeQuizAnswerSpark(userid, match_id, game_id)` → `spark_revoked` 응답
- 스케줄 픽(`game_id` 생략)은 spark 즉시 지급 **안 함** — 매치 종료 후 `rewardQuizParticipation`(다른 트리거)으로 지급

Spark 호출은 quiz 트랜잭션 **밖**에서 실행 (DB pool 점유 회피).

## R4. 채점 (verifyAnswers)

- HTTP API에서 직접 호출하는 것은 `POST /quiz/admin/manual-game-end`만
- 동작:
  - `(match_id, game_id?)`로 모든 `quiz_user_answers` 조회
  - `selected_team_id === winner_id` → `is_correct = 1`, 아니면 0
  - `quiz_user_streaks` / `quiz_user_streaks_monthly` 갱신 (스트릭 +1 또는 reset)
- 멱등성: 동일 (match_id, game_id, winner_id)로 두 번 호출 시 결과 동일해야 함. `is_correct` 재계산 + 스트릭은 이미 처리된 경우 skip.

## R5. 캘린더 / my-picks 응답 일자 기준 (KST)

- 모든 일자 기반 집계는 **KST(Asia/Seoul, UTC+9)** 로 변환 후 그룹화
- `period_value` 형식: `YYYY-MM-DD` (KST 기준)
- `period_month` 형식: `YYYY-MM`
- `today` 파라미터 미지정 시 서버 현재 시각을 KST로 변환

서비스 구현은 `Quiz.Services.ts`의 일자 처리 함수 그대로 사용. timezone 변경 금지.

## R6. 스트릭

| 필드 | 의미 |
|---|---|
| current_win_streak | 연속 정답 수 |
| current_lose_streak | 연속 오답 수 |
| current_streak_type | `'win'` / `'lose'` / `'none'` |
| current_streak_display | `'W{n}'` / `'L{n}'` / `'0'` |

`current_streak_display`:
- type=='win' && cw>0 → `W{cw}`
- type=='lose' && cl>0 → `L{cl}`
- else → `'0'`

(소켓 cmd50/53 payload 호환 — 본 도메인에서도 동일 포맷 유지)

## R7. quiz_user_answers unique 의미

unique 키는 `(userid, match_id, COALESCE(game_id, ''))`. 즉 스케줄 픽(`game_id=NULL`)과 라이브 픽(`game_id='G1'`)은 서로 다른 행으로 공존 가능.

## R8. resultCode 매핑

- 성공: `Success`
- 검증 실패: `validationError` (메시지는 endpoint 별 명시한 문자열 그대로)
- 그 외 비즈니스 에러: `error.code` (있으면) 또는 `error`

서비스에서 `throw Object.assign(new Error(msg), { code: '<CODE>' })` 패턴 사용 — code가 응답 `resultCode`로 그대로 전달됨.

## R9. JWT 적용 매트릭스

| 엔드포인트 | JWT |
|---|---|
| GET /quiz/problem | 없음 |
| PUT /quiz/answer | 필수 |
| GET /quiz/calendar | 필수 |
| GET /quiz/my-picks | 필수 |
| GET /quiz/activity/daily | 필수 |
| GET /quiz/available-problems | 필수 |
| POST /quiz/admin/manual-game-end | **없음** (외부 보호 의무) |

## R10. limit / offset 기본값

- `getTransactions` 류와 달리 quiz는 서비스 측에서 기본값 처리:
  - `limit`: parseInt 후 finite가 아니면 undefined → 서비스가 알아서 처리
  - `offset`: 동일

origin 코드 `Number.isFinite(limit) ? limit : undefined` 그대로 유지.

## R11. 서비스 함수 이식 의무

다음 함수들은 **원본 `Quiz.Services.ts`의 본문을 그대로 이식**합니다. 본 .md에 의사코드 풀어쓰기보다 원본 함수를 그대로 옮기는 게 정확:

- `getProblem(matchId, gameId?)`
- `upsertOrCancelMyPick(userid, matchId, selectedTeamId, gameId?, action?)`
- `getCalendar({userid, year, month, today})`
- `getMyPicks({userid, period_value, period_month, limit, offset})`
- `getDailyActivity({userid, period_value})`
- `getAvailableProblems(userid, matchId?, gameId?)`
- `verifyAnswers(matchId, gameId?, winnerId?)`
- `resolveGameIdForManualQuizEnd(matchId, gameId?, gameNumber?)`
- `closeLiveQuizForGame(matchId, gameId?)`
- `getCurrentStreakInfo(userid)`

**원칙**: HTTP 핸들러는 본 .md 그대로, 서비스 본문은 원본 함수 1:1 복제. ESM 변환 시 import 경로/`.js` 확장자만 조정.

## R12. matches.status 의미

- `not_started` → 스케줄 픽 가능
- `in_progress` → 라이브 픽 가능 (특정 game이 open이어야 함)
- `completed` → 모든 픽 잠금

`matches`는 read-only.

## R13. 응답 일자 컬럼

모든 `created_date`, `updated_date`, `start_at`, `end_at`는 ISO 8601 문자열 또는 Date 객체 그대로(원본). JSON 직렬화는 Express의 기본 `res.json()`을 신뢰 — 별도 변환 금지.

## R14. 에러 응답 시 data

원본 그대로 `data: null` (또는 `null as any`). 변경 금지.

## R15. 관리자 엔드포인트 보호 (R9 보완)

`POST /quiz/admin/manual-game-end`는 JWT 없음. 마이그레이션 시:
- ALB 또는 API Gateway 단에서 별도 인증/허용 IP 제한 적용
- Express에서는 `routes.js`에서 별도 미들웨어 mount 금지 (현 원본 호환 유지)
- PR description에 "어드민 보호 설정 필요" 명시 의무
