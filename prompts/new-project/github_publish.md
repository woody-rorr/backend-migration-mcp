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
1. `mcp__github__create_branch`
   - `owner`: `woody-rorr`
   - `repo`: target repo
   - `branch`: `feature/<도메인용어-kebab>` 예: `feature/quiz-api`
   - `from_branch`: `main`
2. `mcp__github__push_files`
   - 동일 branch, 누적된 모든 파일 1회 푸시
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

## 5. 응답 형식
`publish` scope의 응답 JSON:
```json
{
  "files": {},
  "publish": {
    "branch": "<branch>",
    "pr_url": "<https://github.com/woody-rorr/backend/pull/N>",
    "pushed_files": <N>
  },
  "todo": []
}
```

`pr_url` 추출 실패 시 todo에 `"publish failed: <reason>"` 기록.

## 6. 실패 시 처리
- `create_branch` 가 "Reference already exists" 에러를 반환하면 → branch 이름에 `-<timestamp>` suffix 붙여 재시도 1회.
- `push_files` 실패 시 → 빈 files + todo에 `"push failed: <reason>"` 반환. 자체 git/REST fallback 금지.
- `create_pull_request` 실패해도 branch+push는 유지. todo에 `"PR creation failed: <reason>"` 기록.
