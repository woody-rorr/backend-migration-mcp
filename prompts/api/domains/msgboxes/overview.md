# msgboxes 도메인 개요 (재현 스펙)

## 책임

사용자 쪽지함 조회/카운트/읽음·시청 상태 갱신. spark 도메인의 `getProfile.msgCnt`가 이 도메인 쿼리를 재사용.

## 라우팅 베이스

`app.use('/msgboxes', msgboxesRouter)`.

## 외부 호출

`MSGBoxes.Services.selectNewMessageCount`는 spark 도메인 `getProfile`에서도 호출됨. 별도 DB 연결 사용 가능 (`getConfiguration().LoLDBInfo`) — 마이그레이션 시 단일 pool로 통합 또는 별도 client 모듈 분리. origin과 동작 동일성을 위해 LoLDBInfo가 별개 DB라면 별도 connection 유지.
