# extension 도메인 비즈니스 규칙

## R1. anonymous default

`character_name` 없이 호출 시 항상 동일한 기본 응답 (`Extension.Controller.getLive2dCharacterAnonymousDefault`). 로그인 여부와 무관.

## R2. 공개 캐릭터 조회

특정 `character_name`을 명시하면 그 캐릭터의 공개 메타만 반환. 사용자별 소유 캐릭터와 무관.

## R3. POST의 alias 처리

camelCase / snake_case alias 모두 허용. 우선순위는 원본 코드 순서대로 (snake가 먼저).

## R4. manifest_json 타입 강제

`typeof === 'object'`이면서 배열이 아니어야 함. 그 외(string, array, null)는 `null`로 정규화.

## R5. 업로드 파일명 trim

`upload_files` 배열 각 항목 `String(x).trim()`. 빈문자열은 제거. 결과 배열이 비면 `undefined` 전달.

## R6. S3 / presigned URL

업로드 URL 발급은 origin `Extension.Services` 내부에서 처리. 마이그레이션 시 `src/clients/s3.js`로 분리 가능. 응답 필드명은 origin DTO 그대로.

## R7. 서비스 이식

`Extension.Controller`/`Extension.Services` 함수 1:1 이식. SQL/S3 호출 로직 변경 금지.
