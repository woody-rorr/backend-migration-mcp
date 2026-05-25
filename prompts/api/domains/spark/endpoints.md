# spark 엔드포인트 명세 (재현 스펙)

응답은 모두 `{ resultCode, resultMsg, data }`.

---

## 1. GET /spark/profile

> 내 프로필 + 잔액 + 등급.

**Auth**: JWT 필수. `event.user?.id` → `userid`. `event.user?.picture` → JWT의 picture (구글 OAuth).

**검증**: `userid` 누락 → `validationError "userid is required"`.

**처리**:
- `SELECT email, displayname, picture FROM users WHERE userid = ? LIMIT 1`
  - 없으면 `Error('사용자를 찾을 수 없습니다.')` throw → `resultCode.error`
- `user_balance` 조회 (없으면 exp=0, cash=0)
- `picture`: JWT의 picture가 있으면 그것, 없으면 users.picture, 없으면 null
- 쪽지 카운트: `MSGBoxesServices.selectNewMessageCount({ user_id: userid })`. 실패/예외 시 `msgCnt = 0`
- 등급: `getGradeByExp(exp)`, `getGradeNameByExp(exp)`

**Response data (`GetProfileResponseDto`)**
```ts
{
  email: string | null,
  displayname: string | null,
  picture: string | null,
  exp: number,           // = total spark
  cash: number,
  gradeId: number,       // getGradeByExp
  gradeName: string,     // getGradeNameByExp
  msgCnt: number         // 쪽지 미확인 수, 실패 시 0
}
```

---

## 2. GET /spark/transactions

> 적립/소진 이력 페이지네이션.

**Auth**: JWT 필수.

**Query**
| 키 | 타입 | 기본 |
|---|---|---|
| source_type | string | (필터 없음) |
| start_date | string | (필터 없음). `created_at >= ?` |
| end_date | string | (필터 없음). `created_at <= ?` |
| limit | int | 20 |
| offset | int | 0 |

`limit`/`offset`은 `Number(q.limit)`로 변환. NaN이면 controller가 `?? 20`, `?? 0` 적용.

**처리**:
- `transaction.userid = :userid AND (source_type=?) AND (created_at>=?) AND (created_at<=?)`
- `ORDER BY created_at DESC`
- `total = qb.getCount()` (페이지 적용 전)

**Response data**
```ts
{
  transactions: [
    {
      idx: number,
      userid: string,
      exp: number,
      source_type: string,
      source_id: string | null,
      description: string | null,
      metadata: any | null,    // JSON 객체 (DB에서 JSON 컬럼이면 그대로, 문자열이면 그대로)
      created_at: Date
    }
  ],
  total: number,
  limit: number,
  offset: number
}
```

---

## 3. GET /spark/summary

> **미구현** — 원본 그대로 `not implemented` 응답.

**Auth**: 없음 (라우터 자체에 verifyJWT 적용 안 됨)

**Response**:
```json
{ "resultCode": <error>, "resultMsg": "getSummary is not implemented", "data": null }
```

마이그레이션 시에도 동일하게 유지. 구현 추가 요청이 별도로 오기 전까지는 not-implemented 응답.

---

## 4. POST /spark/rewards/quiz-participation

> 퀴즈 픽 1건에 대한 spark 지급. 멱등.

**Auth**: JWT 필수. `userid`는 **JWT에서 추출** (body의 userid는 무시 — alias만 정규화에 사용).

**Body** (정규화 후)
```json
{
  "userid": "<ignored>",
  "match_id": "<string>",          // alias: matchId, problem_id, problemId
  "game_id": "<string|null>"       // alias: gameId. 빈/누락 = 스케줄 픽 (null)
}
```

**검증**
- JWT userid 없음 → `validationError "userid is required"`
- `match_id` 빈/누락 → `validationError "match_id is required"`

**처리**: `service.rewardQuizParticipation(userid, match_id, game_id)`
- `source_type='quiz_answer'`, `source_id = quizAnswerSparkSourceId(match_id, game_id)`
- 같은 source_id로 이미 earn 기록 있으면 → 중복 지급 거부 (멱등). origin은 `throw Error('User X already received reward for ...')` 패턴. 응답은 `resultCode.error` + 메시지.
- 지급 시 트랜잭션 안에서:
  - `user_balance` 없으면 INSERT, 있으면 `UPDATE user_balance SET exp = exp + ?, UpdateDate = NOW()`
  - `spark_user_transactions` INSERT (`transaction_type='earn'`)

**Response data (`EarnSparkResponseDto`)**
```ts
{
  transaction_idx: number,    // 새로 INSERT된 spark_user_transactions.idx
  exp_earned: number,         // 지급액
  new_total_spark: number     // 적용 후 user_balance.exp
}
```

(필드명은 origin DTO 그대로. 마이그레이션 시 변경 금지.)

---

## 5. POST /spark/rewards/ranking/process-monthly

> 월별 랭킹 보상 일괄 지급. 관리자/내부 스케줄러 용.

**Auth**: **없음**. 외부 보호 필수.

**Body**
```json
{ "period_value": "2026-02" }   // alias: periodValue
```

**검증**:
- `period_value` 빈/누락 → `validationError "period_value is required (e.g. \"2026-02\")"`

**처리**: `service.processMonthlyRankingReward(period_value)`
- `quiz_user_streaks_monthly`에서 해당 `period_value`의 순위 산출
- 각 순위에 정의된 spark 액수 지급 (멱등: `source_type='monthly_ranking_reward'`, `source_id=<period_value>|rank{N}|<userid>`)

**Response data (`RewardRankingResponseDto`)**
```ts
{
  period_value: string,
  processed: number,        // 지급된 사용자 수
  skipped: number,          // 이미 지급된(멱등) 수
  total_exp: number,        // 합산 지급 exp
  details?: [...]           // origin DTO에 정의된 추가 필드 그대로
}
```

origin `Spark.Services.processMonthlyRankingReward` 본문을 1:1 이식.
