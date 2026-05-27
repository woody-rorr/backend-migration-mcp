# backend-migration-mcp

**2개 도메인을 담당하는 단일 MCP 서버.**
1. `migration` — Lambda(Serverless) → ECS(Express) 코드 변환
2. `new-project` — NestJS 기반 신규 API 서버 코드 생성 (레거시 미참조)

Claude 에이전트가 호출하면 도메인별 .md 명세만 보고 코드를 생성/변환해 반환합니다.
**add/commit/push/PR은 GitHub MCP가 담당** — 본 MCP는 생성/변환만 합니다.

## 역할 분리

| 구성 요소 | 책임 |
|---|---|
| `backend-migration-mcp` (본 레포) | 두 도메인 코드 생성/변환, Dockerfile/task-def 생성 |
| GitHub MCP | 결과 파일을 도메인별 target 레포로 add/commit/push/PR |
| `backend-migration` (target) | migration 도메인 출력 — Express API 서버 (ECS :5012) |
| `new-project` (target, 신규) | new-project 도메인 출력 — NestJS API 서버 (ECS :5013 예정) |

## 도메인별 디렉토리

```
prompts/
├── migration/         # Lambda → Express 변환용 지시문
└── new-project/       # NestJS 신규 생성 지시문

resources/
├── migration/         # 마이그레이션 컨텍스트 (db, env, 로깅, 타겟 스택)
└── new-project/       # 신규 프로젝트 명세 (00~07 .md, spec-first)
```

`new-project/`는 `/Users/pinetech/Desktop/mcp/new-project/docs/`의 사본을 두며,
**spec-first** 원칙: 코드 생성 전 .md를 먼저 갱신.

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

**migration 도메인**
- `analyze_lambda_project` — serverless.ts/yml에서 route inventory 추출
- `convert_handlers` — Lambda 핸들러 → Express 라우터 변환 (resources/migration, prompts/migration만 로드)
- `generate_docker_assets` — Dockerfile / entrypoint / task-def 생성

**new-project 도메인**
- `scaffold_new_project_api` — resources/new-project/*.md 명세만 보고 NestJS 코드 생성. 기존 레거시 코드 미참조.

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
