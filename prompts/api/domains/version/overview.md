# version 도메인 개요 (재현 스펙)

## 책임

서비스 버전별 사용 엔드포인트 정보 조회. 클라이언트가 자신의 앱 버전을 알려주면 그에 맞는 API 경로/플래그를 받음.

## 라우팅 베이스

`app.use('/common', versionRouter)` — path가 `/common/getVersion` (원본 호환).
