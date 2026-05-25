# datacenter 도메인 비즈니스 규칙

## R1. 인증 없음 + 외부 보호

origin에 verifyJWT 적용 없음. 마이그레이션도 그대로:
- ALB rule: 사내/배치 IP만 허용
- 또는 별도 secret header 검증 미들웨어 추가 (origin 호환 깨면 안 됨 → 별도 PR로 결정)

PR description에 "datacenter 라우트 보호 설정 의무" 명시.

## R2. upsert 시멘틱

모든 set* 엔드포인트는 PK(id) 기준 upsert:
- 존재하면 UPDATE
- 없으면 INSERT

origin SQL 그대로. ON DUPLICATE KEY UPDATE 또는 service 내부에서 findOne→update/insert 분기.

## R3. 트랜잭션

배열로 들어오는 항목들은 한 트랜잭션 안에서 처리 (일부 실패 시 전체 롤백). origin Service 본문 그대로.

## R4. setUpdateMatcheInfo 특수성

매치 결과(winner, status='completed' 등) 갱신용. 일반 setMatchesSchedulesOfLoL과 분리된 이유:
- 다른 컬럼 set
- side effect: 매치 종료 시 quiz/spark 도메인 트리거 가능성 (현재 origin은 직접 호출 없음 — 추후 추가 시 본 룰 갱신)

## R5. 외부 소스와의 시간 동기화

origin 일부 함수에서 `created_date`를 `now()`가 아닌 외부 소스 timestamp 사용. 변환 로직은 origin Service 그대로.

## R6. 응답 항상 null

성공도 `null`. 어떤 행이 INSERT/UPDATE되었는지 응답에 안 담음. 통계는 로그로만.

## R7. 서비스 이식

`DatacenterCtrl.*` 7개 함수 + `Datacenter.Services` 1:1. 외부 API 호출(주석 처리된 PandaScore)은 활성화 금지.

## R8. 옛 주석 코드 무시

origin index.ts/handler.ts에 PandaScore 관련 주석 처리된 코드 있음. 마이그레이션에서 그대로 주석 유지 또는 삭제 (활성 routes에 영향 없음).
