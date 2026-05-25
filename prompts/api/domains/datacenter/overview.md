# datacenter 도메인 개요 (재현 스펙)

## 책임

LoL 경기 데이터를 외부 소스(PandaScore 등)에서 받아 DB에 upsert. 어드민/배치 진입점. schedules 도메인이 이 데이터를 read-only로 노출.

## 라우팅 베이스

`app.use('/datacenter', datacenterRouter)`.

## 엔티티 (쓰기 대상)

`leagues`, `series`, `tournaments`, `matches`, `teams`, `players` — datacenter만 INSERT/UPDATE. 다른 도메인은 read-only.

## 외부 의존

PandaScore API (옛 트리거 — 주석 처리됨). 현재는 외부 시스템이 datacenter API를 호출해 데이터를 push하는 형태.
