# players 도메인 개요 (재현 스펙)

## 책임

선수 정보를 외부에서 받아 DB에 set(upsert). 어드민/배치 진입점.

## 라우팅 베이스

`app.use('/players', playersRouter)`.
