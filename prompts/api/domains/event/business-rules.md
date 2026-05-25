# event 도메인 비즈니스 규칙

## R1. 정렬

`created_date DESC` 고정. page=1이 최신 구간. 이 정렬 변경 시 클라이언트 호환성 깨짐.

## R2. per_page clamp

- per_page < 1 → 20
- per_page > 100 → 100

origin 코드의 `Number.isFinite` 체크와 동일하게 마이그레이션. NaN은 기본값 20으로 fallback.

## R3. 검증 실패 시에도 빈 구조 반환

`match_id` 누락이면 `data: null` 아니라 `data: { events: [], total: 0, page: 1, per_page: 20 }` 반환. 프론트가 일관된 구조를 받도록.

## R4. game_id

빈문자열은 undefined로 처리 (전체 매치). 명시적 `game_id`가 있으면 해당 게임만 필터.

## R5. 서비스 이식

`Event.Controller.getEvents` + `Event.Services` 그대로 이식. SQL/페이징 로직은 origin 함수 본문 1:1 복사.
