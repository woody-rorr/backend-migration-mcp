# version 엔드포인트 명세

## POST /common/getVersion

> 버전별 endpoint 정보 조회.

**Auth**: 없음.

**Body** (`schema` 검증 통과 필요 — origin `version/schema.ts` 그대로 이식)
- 클라이언트 식별 정보 (앱 종류/현재 버전 등)

**처리**: `VersionCtrl.getVersionInfo(body)` → `IResponseVersionInfo` 반환

**Response data** (origin `Version.Interface.IResponseVersionInfo`)
- 버전별 endpoint 목록, feature flags 등

## 비고

마이그레이션 시 `schema.ts`는 zod로 옮기되 필드명/타입 유지.
