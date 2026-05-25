# quiz 도메인 개요 (재현 스펙)

> 이 도메인은 **HTTP API만** 본 .md 3종으로 다룹니다. MSK(Kafka)/소켓/cmd 39/40/41/50/51 등 라이브 푸시는 별도 도메인(`quiz-realtime`)으로 분리 예정 — 본 문서 범위 밖.

## 책임

e스포츠 경기에 대한 사용자 픽(우승팀 예측) 수집·채점·스트릭 관리·일일/월별 활동 집계. 스케줄(경기 전) 픽과 라이브(경기 중) 픽 두 모드 지원.

## 두 가지 모드

| 모드 | 트리거 | `game_id` |
|---|---|---|
| 스케줄 픽 | 경기 시작 전, 매치 전체 1회 | **생략** (null) |
| 라이브 픽 | 경기 중, 매 게임마다 | **필수** (cmd50과 동일 문자열) |

`game_id` 유무가 비즈니스 분기 전체를 가른다. 라이브 픽은 매 게임 종료마다 채점/스트릭 반영, 스케줄 픽은 매치 전체 결과로 1회 채점.

## 엔티티 (기존 DB — 변경 금지)

사용하는 컬럼만 명시. 모든 컬럼 형태/제약은 기존 그대로 유지.

### `quiz_problems`
| 컬럼 | 비고 |
|---|---|
| match_id | string, 매치 식별자 |
| problem_*, options 관련 컬럼 | 문제 본문/선지 |
| start_at, end_at | 응답 가능 시각 |
| status | `not_started` / `in_progress` / `completed` 등 |

### `quiz_user_answers`
| 컬럼 |
|---|
| idx (pk), userid, match_id, game_id (nullable — 스케줄=null), selected_team_id, action(`submit`/`cancel`), is_correct, created_date, updated_date |

unique 제약(요지): `(userid, match_id, game_id NULL-coalesced)` 1회만.

### `quiz_user_streaks`, `quiz_user_streaks_monthly`
스트릭 카운트, 월별 랭킹 보상 후보.

### `match_game_live_quiz`
| 컬럼 |
|---|
| match_id, game_id, game_number, live_quiz_open ('Y'/'N'), opened_at |

라이브 퀴즈 오픈/종료 상태 트래킹. HTTP API에서는 **read-only**만 사용 (오픈/종료 갱신은 MSK 도메인 책임).

### `matches`
| 컬럼 |
|---|
| match_id, status('completed' 등), winner_id, scheduled_at |

read-only.

## 라우팅 베이스

`app.use('/quiz', quizRouter)`.

## 공통

- 응답: `{ resultCode, resultMsg, data }`
- 인증: HTTP 7개 중 `GET /quiz/problem`만 공개, **나머지 모두 JWT 필수**. `POST /quiz/admin/manual-game-end`은 JWT 미적용(현 원본 동작 그대로) — API Gateway/WAF로 제한 권장.
- `match_id` / `game_id`는 **항상 문자열**로 정규화 (JSON 큰 정수 깨짐 회피). `normalizeQuizId(v)` = `v != null ? String(v).trim() : ''`. `optionalQuizGameId(v)` = 비어있으면 `undefined`, 아니면 trim된 문자열.

## 도메인 경계

- read 의존: `matches`, `teams`, `match_game_live_quiz`
- write 의존(타 도메인 컬럼): 없음
- spark 도메인 호출: `SparkCtrl.rewardQuizParticipation`, `SparkCtrl.revokeQuizAnswerSpark` (정답 제출/취소 시) — 현 시점 service 직접 호출. spark 도메인이 분리되면 HTTP 또는 service-interface 경유로 리팩토링.
