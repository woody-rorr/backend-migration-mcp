# quiz 엔드포인트 명세 (재현 스펙)

> 본 문서는 **HTTP API 7개**만 정의. MSK/소켓 핸들러(quizAnswerVerification, liveQuizOpenPush, liveQuizSyncOnConnect)는 분리 도메인.

응답은 모두 `{ resultCode, resultMsg, data }`.

---

## 1. GET /quiz/problem

> 매치(또는 라이브 게임) 문제 조회. 공개 엔드포인트 (JWT 없음).

**Query**
| 키 | 타입 | 필수 |
|---|---|---|
| match_id | string | **yes** |
| game_id | string | no (생략 = 스케줄) |

**검증**
- `match_id` 빈 문자열/누락 → `validationError "match_id is required"`

**처리**
- `service.getProblem(match_id, game_id)` 호출
- 내부적으로 `quiz_problems` 조회 + 라이브이면 `match_game_live_quiz` 상태 동봉

**Response data**
- 문제 본문, 선지, start_at/end_at, status, (라이브 시) opened_at, live_quiz_open

---

## 2. PUT /quiz/answer

> 픽 제출/수정/취소. 스케줄/라이브 둘 다 처리.

**Body** (JSON)
```json
{
  "match_id": "<string>",          // 또는 problem_id 사용 (alias)
  "game_id": "<string>",           // 라이브일 때만, 스케줄 시 생략/null
  "selected_team_id": "<string>",  // submit/update 시 필수
  "action": "submit" | "cancel"    // 기본 'submit'. 'cancel'이면 selected_team_id 없어도 됨
}
```

**검증 (순서)**
1. JWT → `event.user.id` 없으면 `validationError "userid is required"`
2. body 파싱 (string이면 JSON.parse). 실패도 그대로 전파 (현 원본은 명시 핸들링 없음)
3. `match_id = normalizeQuizId(body.match_id ?? body.problem_id)` — 빈 문자열이면 `validationError "match_id is required"`
4. `gameIdNorm = optionalQuizGameId(body.game_id)` — 빈/null이면 스케줄 픽
5. `isCancel = (action === 'cancel')`
6. NOT cancel이고 `selected_team_id` 누락/빈문자열이면 `validationError "제출·수정 시 selected_team_id is required"`

**처리**
- `service.upsertOrCancelMyPick(userid, matchId, selected_team_id, gameIdNorm, isCancel ? 'cancel' : action ?? 'submit')`
- 내부 동작 (business-rules.md R2 참조):
  - 동일 (userid, match_id, game_id) 행 있으면 UPDATE, 없으면 INSERT
  - `action='cancel'`이면 `selected_team_id=NULL` 또는 행 삭제 (R2)
  - 채점은 경기 종료 이벤트 수신 시 (verifyAnswers)
  - 라이브 픽 제출 시 spark 즉시 지급 (`SparkCtrl.rewardQuizParticipation`), 취소 시 회수 (`revokeQuizAnswerSpark`)

**Response data**
```ts
{
  match_id: string,
  game_id: string | null,
  selected_team_id: string | null,
  action: 'submitted' | 'updated' | 'canceled',
  spark_granted?: number,      // 라이브 픽 제출 시 지급된 spark
  spark_revoked?: number       // 취소 시 회수된 spark
}
```

**에러**
- 비즈니스 에러는 `error.code` 우선 사용 (없으면 `resultCode.error`)
- 예: `MATCH_NOT_FOUND`, `QUIZ_CLOSED`, `LIVE_QUIZ_NOT_OPEN`, `PICK_LOCKED` — Quiz.Services의 실제 코드와 일치시킴 (business-rules.md R2 표 참조)

---

## 3. GET /quiz/calendar

> 월별 스트릭 캘린더.

**Query**
| 키 | 타입 | 필수 | 비고 |
|---|---|---|---|
| year | int | **yes** | parseInt 결과 NaN이면 검증 실패 |
| month | int | **yes** | 1~12 권장, 서비스에서 그대로 사용 |
| today | string | no | YYYY-MM-DD, 클라이언트가 기준일 명시 |

**검증**
- JWT → userid 필수
- year/month 누락 또는 NaN → `validationError "year, month are required"`

**처리**
- `service.getCalendar({ userid, year, month, today })`

**Response data**
- 일자별 정답/오답/픽 없음 상태 배열
- 월별 누적 W/L 스트릭
- 정확한 구조는 `GetCalendarResponseDto` (business-rules.md R5)

---

## 4. GET /quiz/my-picks

> 내 픽 이력. 일자 또는 월 단위.

**Query**
| 키 | 타입 | 필수 | 비고 |
|---|---|---|---|
| period_value | YYYY-MM-DD | no | 해당 일자 픽 |
| period_month | YYYY-MM | no | 해당 월(최신순) |
| limit | int | no | parseInt, NaN/<=0이면 undefined |
| offset | int | no | parseInt, NaN이면 undefined |

`period_value`와 `period_month` 둘 다 없으면 서비스가 기본 로직 (전체 최신순) 적용.

**처리**
- `service.getMyPicks({ userid, period_value, period_month, limit, offset })`

**Response data**
- 픽 목록: `{ match_id, game_id, selected_team_id, is_correct, created_date, ...매치 메타 }`
- 페이지 정보 (limit, offset, total/hasMore 등 서비스 그대로)

---

## 5. GET /quiz/activity/daily

> 특정 일자의 활동 요약.

**Query**
| 키 | 타입 | 필수 |
|---|---|---|
| period_value | YYYY-MM-DD | no (서비스 기본값 적용 가능) |

**처리**
- `service.getDailyActivity({ userid, period_value })`

**Response data**
- 그 날 픽 개수, 정답/오답, 누적 W/L, spark 적립 등 (서비스 DTO 그대로)

---

## 6. GET /quiz/available-problems

> 현재 풀 수 있는 문제 목록.

**Query**
| 키 | 타입 | 필수 |
|---|---|---|
| match_id | string | no — 빈/누락이면 undefined |
| game_id | string | no |

**처리**
- `service.getAvailableProblems(userid, matchId?, gameId?)`

**Response data**
- 풀 수 있는 (match_id, game_id?) 조합 배열 + 각 항목의 상태(unanswered/answered/locked)

---

## 7. POST /quiz/admin/manual-game-end

> Kafka cmd 41 미수신 시 수동 경기 종료 트리거. **JWT 미적용**.

**Body**
```json
{
  "match_id": "<string>",          // 필수
  "game_id": "<string>",           // optional (생략 시 service가 game_number로 resolve)
  "game_number": "<string>",       // optional, "game1" / "game2" 등
  "winner_id": "<string>"          // 필수
}
```

(alias 허용: `matchId`, `gameId`, `gameNumber`, `winnerId`)

**검증**
- `match_id` 빈문자 → `validationError "match_id is required"`
- `winner_id` 빈문자 → `validationError "winner_id is required"`

**처리**
1. `service.resolveGameIdForManualQuizEnd(match_id, game_id ?? null, game_number ?? null)` — `game_id` 우선, 없으면 `game_number`로 `match_game_live_quiz`에서 해석
2. `Controller.onMskGameEnd(matchId, resolved, winnerId)` 호출 (`closeLiveQuizForGame` + `verifyAnswers`)

**Response data**
```ts
{
  processed: number,         // verifyAnswers가 채점한 답 수
  resolved_game_id: string | null
}
```

**보안**
- 인증 없음 → API Gateway 인증/WAF/IP 화이트리스트로 보호 필수. PR description에 명시.
