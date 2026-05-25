# teams 도메인 비즈니스 규칙

## R1. setTeams JWT 외 권한 분기 없음

players와 동일 — JWT만 검증. admin role은 origin에서 확인 안 함.

## R2. getTeams 응답 구조

`IResponseGetTeamsForLoL` 필드 변경 금지. 클라이언트가 키로 분기.

## R3. 서비스 이식

`TeamCtrl.setTeamInfo` / `getTeamInfo` + `Team.Services` 1:1.
