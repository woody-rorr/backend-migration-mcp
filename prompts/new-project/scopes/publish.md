# scopes/publish — 누적 파일 push + PR (Critical)

## 0. 사전 점검
`common/precheck.md` 1~3 단계만 (publish 는 신규 자원 생성 없음).

## 1. 기본 규약
- 코드 생성 금지. `github_publish.md` §2 순서대로 `mcp__github__create_branch` → `push_files` → `create_pull_request` 호출.
- 누적된 모든 파일을 한 번에 push (단일 파일 push 금지).
- 응답에 `publish.pr_url` 포함.

## 2. 안전 게이트 (사고 방지)
publish 호출 시 아래 조건 검사. 위반 시 push 금지하고 `todo: ["abort: <이유>"]` 응답.

### 게이트 1 — 부트스트랩만 push 금지
누적 files 맵에 `src/modules/<name>/` 경로가 0개이고 부트스트랩 파일(`package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example`, `deploy/Dockerfile`, `.github/workflows/deploy.yml`, `.gitignore`)만 있으면 push abort.
→ `"abort: 모듈 코드 없음. module:<name> scope 먼저 호출"`

### 게이트 2 — 기존 레포 부트스트랩 덮어쓰기 차단
target 레포(`woody-rorr/backend`)에 push 전 `mcp__github__get_file_contents` 로 `package.json` 존재 여부 확인. 이미 존재하면 누적 files 맵에서 다음 경로 제거 후 push:
- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`
- `.env.example`, `.gitignore`
- `deploy/Dockerfile`, `deploy/entrypoint.sh`
- `.github/workflows/deploy.yml`

(기존 인프라 보존)

### 게이트 3 — 제거 후 push 할 파일이 0개
→ `"abort: 신규 추가할 코드 없음 (전부 기존 인프라와 중복)"`

## 3. todo 예시
```json
"todo": [
  "next: app-shell",
  "next: database (users table)",
  "next: module:users",
  "next: auth",
  "next: tests:auth"
]
```
