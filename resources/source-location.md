# 원본 Lambda 프로젝트 위치

본 MCP는 코드 변환만 수행합니다. **레포 add/commit/PR은 GitHub MCP가 담당** (Pattern 1).

## 원본 (Source)

사용자가 별도 경로를 지정하지 않으면 다음 위치를 기본값으로 사용합니다:

- **로컬 경로 (현재):** `~/Desktop/mcp/backend-migration/backend-lol-api-v3_origin`
- **GitHub URL (향후 교체 예정):** `https://github.com/<org>/backend-lol-api-v3`

> 오케스트레이터(Claude CLI)가 사용자의 자연어 요청 ("그냥 고쳐줘", "X 엔드포인트 수정해줘")을 받으면, 위 경로에서 `serverless.ts` / `src/functions/**` 를 읽어 본 MCP의 `analyze_lambda_project` / `convert_handlers` 도구에 텍스트로 전달합니다.

## 대상 (Target — 변환 결과 PR 대상)

- **레포:** `woody-rorr/backend-migration`
- **ECS 서비스:** `backend-migration-service` (포트 5012)
- **흐름:** 본 MCP의 변환 결과(`files: { path: content, ... }`) → GitHub MCP가 branch/commit/PR 생성 → main merge → GitHub Actions가 ECS 5012 자동 배포.

## 본 MCP가 절대 하지 않는 것

- git add / commit / push
- GitHub API 호출 (PR/이슈/브랜치)
- 인프라 변경 (ECS/ALB/SG 등은 이미 구성됨, 코드만 배포되면 됨)

이 작업들은 모두 외부 MCP(github MCP) 또는 GitHub Actions가 담당합니다.
