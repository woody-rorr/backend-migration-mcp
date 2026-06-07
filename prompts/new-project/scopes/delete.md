# scopes/delete — delete:<name> 모듈 제거 (Critical — 절반 삭제 금지)

모듈 제거는 **반드시 한 호출에서 다음을 모두 처리**한다. 일부만 지우면 잔재 파일이 깨진 import 를 만들어 `nest build` 실패 (관측: 2026-06-01, `news/posts/` 일부만 남고 `dto/`·`entities/` 삭제 → TS2307 5개, CI exit 1).

## 0. 사전 점검
`common/precheck.md` 1~3 단계만 (FK 검증 skip — 삭제 작업).

## 1. 산출(=삭제) 대상 묶음 — 빠짐없이 한 PR 에 포함
1. `src/modules/<name>/<name>.module.ts`
2. `src/modules/<name>/<name>.controller.ts`
3. `src/modules/<name>/<name>.service.ts`
4. `src/modules/<name>/<name>.repository.ts`
5. `src/modules/<name>/dto/` 디렉토리 전체
6. `src/modules/<name>/entities/` 디렉토리 전체
7. `src/modules/<name>/__tests__/` 디렉토리 전체 (존재 시)
8. `src/database/migrations/*-create-<table>-table.ts` (해당 모듈 전용 테이블이면)
9. **`src/app.module.ts` 갱신** — 해당 `<Name>Module` import 라인과 `imports: [...]` 등록 라인 제거. 전체 파일 새 내용으로 덮어쓰기.

## 2. 응답 규약
- `files` 맵에는 갱신된 `src/app.module.ts` 한 개만 (다른 파일들은 삭제 대상이므로 맵에 넣지 않음).
- 별도 필드 `deletions: ["src/modules/<name>/..."]` 에 위 1~8 경로를 모두 나열.
- `publish` scope 가 `deletions` 를 보면 `mcp__github__delete_file` 을 각 경로마다 호출 후 `push_files` 로 `app.module.ts` 갱신.

## 3. 검증
LLM 은 응답 직전 `deletions` 가 `src/modules/<name>/` 하위 파일을 **모두** 포함하는지 확인. 일부만 있으면 코드 생성 금지 + `todo: ["spec-fix: delete:<name> 일부 파일 누락 — 전체 묶음 필요"]`.
