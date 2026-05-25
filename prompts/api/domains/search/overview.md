# search 도메인 개요 (재현 스펙)

## 책임

리그/팀/선수를 통합 검색. boost 우선 정렬. follow 표시는 프론트에서 처리(본 도메인은 boostYN만 반환).

## 라우팅 베이스

`app.use('/search', searchRouter)` — path 자체가 `/search` 단일.
