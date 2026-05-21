# backend-migration-mcp

Lambda(Serverless framework) → ECS(Express) 코드 마이그레이션 MCP 서버. Claude 에이전트가 호출하면 원본 Lambda 핸들러를 Express 라우터 코드로 변환해 반환합니다. **add/commit/push/PR은 GitHub MCP가 담당** — 본 MCP는 변환만 합니다.

## 역할 분리

| 구성 요소 | 책임 |
|---|---|
| `backend-migration-mcp` (본 레포) | 코드 변환 (Lambda → Express), Dockerfile/task-def 생성 |
| GitHub MCP | 변환 결과를 `backend-migration` 레포로 add/commit/push/PR |
| `backend-migration` | 변환된 Express API 서버 코드 (ECS에 ALB로 노출) |

## AWS 배포 환경 (고정)

| 항목 | 값 |
|---|---|
| AWS Profile | `rorr-dev` |
| AWS Account | `239460481239` |
| Region | `us-east-1` |

## 리소스 네이밍 (고정)

| 리소스 | 이름 |
|---|---|
| ECR 레포 | `backend-migration-mcp` |
| ECS Cluster | `mcp-agents-staging-cluster` |
| ECS Service | `backend-migration-mcp-service` |
| ECS Task Definition | `backend-migration-mcp-task` |
| ALB | `mcp-agents-staging-alb` (공유) |
| Target Group | `backend-migration-mcp-tg` |
| ALB 리스너 포트 | `5011` |
| 컨테이너 포트 | `5011` |
| CloudWatch 로그 그룹 | `/ecs/backend-migration-mcp` |
| Task Execution Role | `backend-migration-mcp-execution` |
| Task Role | `backend-migration-mcp-task` |

## 인증 (Claude OAuth만)

- AWS Bedrock 미사용, Anthropic API key 미사용.
- Claude OAuth credentials를 AWS SSM에 저장 → entrypoint.sh가 `~/.claude/.credentials.json`로 복원.
- SSM 파라미터:
  - `/backend-migration-mcp/claude-credentials` (SecureString, JSON)
  - `/backend-migration-mcp/github-repo-url` (String, `https://github.com/woody-rorr/backend-migration.git`)

## MCP 툴

- `analyze_lambda_project` — serverless.ts/yml에서 route inventory 추출
- `convert_handlers` — Lambda 핸들러 → Express 라우터 변환
- `generate_docker_assets` — Dockerfile / entrypoint / task-def 생성

## 포트 정책 (mcp-agents-staging-cluster)

| 포트 | 사용 |
|---|---|
| 4000 | (사용중) |
| 5004 | (사용중) |
| 5010 | rorr-infra-mcp |
| **5011** | **backend-migration-mcp (this)** |
| **5012** | **backend-migration-api** |

## 배포

```bash
export AWS_PROFILE=rorr-dev
bash deploy/deploy.sh
```

## MCP 접속

`http://<ALB DNS>:5011/mcp`
