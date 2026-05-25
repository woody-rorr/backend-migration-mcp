# schedules 도메인 비즈니스 규칙

## R1. Read-only

이 도메인은 데이터 INSERT/UPDATE 금지. datacenter 도메인이 그 책임.

## R2. 응답 DTO 고정

각 `IResponseGet*ForLoL` 필드는 클라이언트가 키로 분기 — 변경 금지.

## R3. 메모리 사용

대량 매치/시리즈 조회 응답이 큼. 원본 Lambda는 `memorySize: 2024` 사용. ECS는 메모리 충분 — 별도 설정 불필요.

## R4. 필터 조건

각 body의 필드(`league_id`, `tournament_id`, 날짜 범위 등)는 schema 그대로. 누락 시 서비스 기본 동작 (전체 또는 최근 N개).

## R5. 정렬

origin SQL의 `ORDER BY`를 그대로 유지 — 통상 `start_at ASC` 또는 `scheduled_at ASC`. 변경 시 프론트 영향.

## R6. 서비스 이식

`Schedule.Controller.*` 5개 함수 + `Schedule.Services` 1:1.
