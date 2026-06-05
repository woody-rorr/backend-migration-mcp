# github_publish — scaffold 결과를 GitHub에 PR로 올리는 절차

> `scaffold_new_project_api` 가 `publish` scope 호출을 받으면 이 가이드를 따른다.
> 모든 git/PR 작업은 **GitHub MCP 도구만** 사용한다. REST/CLI/`gh`/local git 금지.

## 0. 트리거
- scope = `publish` 인 호출이 들어오면 코드 생성 대신 이 절차를 실행한다.
- 입력: 이전 scope들에서 누적된 `files` 맵 (호출자가 `accumulated_files` 또는 `extra_spec` 으로 전달) + target repo.

## 1. Target repo (고정)
- new-project: `woody-rorr/backend`
- migration: `woody-rorr/backend-migration`

## 2. 호출 순서 (정확히 이 순서)

### 2.0 기존 상태 fetch (Critical — 위반 시 기존 모듈/테이블 wipe)
push 직전, **반드시** `mcp__github__get_file_contents`로 target 레포의 다음을 main 기준으로 조회한다:

1. `src/app.module.ts` — 현재 등록된 모듈 imports 목록
2. `src/database/migrations/` (디렉토리 listing) — 기존 migration 파일명 전부

이 두 정보를 갖고 **additive merge** 수행:

- **app.module.ts**: 기존 파일을 받아서 import 목록과 `@Module({ imports: [...] })` 배열에 신규 모듈만 **append**. 기존 import/모듈 등록을 절대 삭제·재배치하지 않는다. 신규 모듈이 이미 존재하면 중복 추가 금지.
- **마이그레이션 충돌 회피**:
  - 기존 migration 파일명에 이미 같은 `<verb>-<target>` (예: `create-follows-table`) 이 있으면 신규 migration 파일을 **drop**. accumulated_files에서 빼고 todo에 `"skipped duplicate migration: <기존파일명>"` 기록.
  - 신규 migration의 timestamp가 기존 max timestamp보다 작거나 같으면 → 신규 timestamp를 `max(existing)+1`로 rename (파일명·클래스명 둘 다).

이 §2.0을 건너뛰고 push하면 PR #64형 사고 재발: 기존 RankingsModule이 app.module.ts에서 삭제되거나, 같은 테이블을 만드는 migration 2개가 들어가 부팅 실패.

### 2.1 push & PR
1. `mcp__github__create_branch`
   - `owner`: `woody-rorr`
   - `repo`: target repo
   - `branch`: `feature/<도메인용어-kebab>` 예: `feature/quiz-api`
   - `from_branch`: `main`
2. `mcp__github__push_files`
   - 동일 branch, 누적된 모든 파일 1회 푸시 (§2.0의 merge 결과 반영된 app.module.ts 사용)
   - `message`: `feat(<도메인>): scaffold <모듈 목록>` 형식
3. `mcp__github__create_pull_request`
   - `head`: 위 branch
   - `base`: `main`
   - `title`: `feat(<도메인>): <한 줄 요약>` (70자 이내)
   - `body`: 아래 §4 템플릿

## 3. 절대 금지
- 단일 파일 push (`create_or_update_file`) 사용 금지 — 반드시 `push_files` 로 한 번에.
- 브랜치를 main으로 잡지 말 것.
- PR 머지/close 금지. 생성만 한다.
- credentials, env value, token을 PR body/commit message에 포함 금지.

## 4. PR body 템플릿
```markdown
## Summary
- 도메인: <한 문장>
- 생성된 모듈: <module 목록 콤마 구분>
- 엔드포인트 수: <N>

## 자동 통합
- `src/app.module.ts` 가 새 모듈을 imports 에 포함하도록 갱신됨
- `src/database/data-source.ts` migrations 경로에 신규 migration 포함

## Test plan
- [ ] CI deploy.yml 통과 확인
- [ ] `/api-docs` Swagger 로딩 확인
- [ ] 신규 엔드포인트 1개 smoke test
```

## 4.5 PR 생성 후 CI 빌드 검증 (Critical — 빌드 실패 PR 머지 사고 방지)
`create_pull_request` 성공 직후 다음 절차로 빌드 결과를 응답에 포함한다:

1. **잠시 대기** (5초 정도) — GitHub Actions가 트리거되도록.
2. `mcp__github__pull_request_read({ method: "get_check_runs", owner, repo, pullNumber })` 호출.
3. 결과 분석:
   - 모든 check가 `status: completed` + `conclusion: success` → 응답 `publish.build_status: "passed"`
   - 일부 in_progress/queued → 응답 `publish.build_status: "running"`, todo에 `"build pending: check PR after CI completes"` 기록
   - 하나라도 `conclusion: failure` → 응답 `publish.build_status: "failed"`, `publish.failed_checks: [{ name, conclusion, details_url }]`, todo에 `"build failed: see <details_url>"` 기록

4. 빌드 실패 시 **재호출 금지 (publish 단일 호출 가드)** — 사용자에게 정직 보고. 다음 turn에서 호출자가 수정 사항으로 새 publish 호출하면 됨.

관측 사례 (2026-06-05): PR #46이 spark/roles 의존성 누락으로 TS2307 에러였지만 publish 응답이 PR URL만 주고 빌드 상태 보고 안 함 → 사용자가 머지하고 나서야 ECS 부팅 실패 발견.

## 5. 응답 형식
`publish` scope의 응답 JSON:
```json
{
  "files": {},
  "publish": {
    "branch": "<branch>",
    "pr_url": "<https://github.com/woody-rorr/backend/pull/N>",
    "pushed_files": <N>,
    "build_status": "passed" | "running" | "failed",
    "failed_checks": [{ "name": "build", "conclusion": "failure", "details_url": "..." }]
  },
  "todo": []
}
```

`pr_url` 추출 실패 시 todo에 `"publish failed: <reason>"` 기록.

## 6. 실패 시 처리
- `create_branch` 가 "Reference already exists" 에러를 반환하면 → branch 이름에 `-<timestamp>` suffix 붙여 재시도 1회.
- `push_files` 실패 시 → 빈 files + todo에 `"push failed: <reason>"` 반환. 자체 git/REST fallback 금지.
- `create_pull_request` 실패해도 branch+push는 유지. todo에 `"PR creation failed: <reason>"` 기록.
