# event 도메인 개요 (재현 스펙)

## 책임

`ai_game_commentary` 테이블의 게임 이벤트 목록을 페이지네이션해 제공. AI 해설/하이라이트용.

## 라우팅 베이스

`app.use('/event', eventRouter)`.

## 엔티티 (기존 DB)

`ai_game_commentary` (read-only):
- match_id, game_id (nullable), event content, created_date, ...
