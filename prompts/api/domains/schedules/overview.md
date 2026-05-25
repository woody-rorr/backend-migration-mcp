# schedules 도메인 개요 (재현 스펙)

## 책임

LoL 경기 일정 조회 (리그/시리즈/토너먼트/매치). datacenter 도메인이 set한 데이터를 read-only로 노출.

## 라우팅 베이스

`app.use('/schedules', schedulesRouter)`.

## 데이터 소스 (read-only)

`leagues`, `series`, `tournaments`, `matches` 테이블. datacenter 도메인이 INSERT/UPDATE 담당.
