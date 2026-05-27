# Stack & Deploy

## 1. 런타임 스택
| 항목 | 값 |
|---|---|
| 언어 | TypeScript 5.x |
| 프레임워크 | **NestJS 10.x** |
| Node | 20 LTS |
| 패키지 매니저 | pnpm (or npm — TBD) |
| ORM | TBD (`04-data-layer.md` 참조) |
| Validation | `class-validator` + `class-transformer` |
| API 문서 | `@nestjs/swagger` |

## 2. 프로젝트 디렉토리 규약
```
src/
├── main.ts                       # bootstrap, Swagger, ValidationPipe
├── app.module.ts
├── common/                       # cross-cutting only
│   ├── filters/                  # exception filter
│   ├── interceptors/             # logging, transform
│   ├── guards/                   # auth guard
│   └── decorators/
├── config/                       # env 로딩 (@nestjs/config)
├── database/                     # data source, migrations
└── modules/
    └── <feature>/
        ├── <feature>.module.ts
        ├── <feature>.controller.ts
        ├── <feature>.service.ts
        ├── <feature>.repository.ts
        ├── dto/
        └── entities/
```
**규칙**
- 모듈 간 직접 import 금지 → 필요한 경우 `exports`에 명시한 service만.
- `common/`은 두 개 이상 모듈이 실제로 쓰는 것만 승격.

## 3. AWS 배포 환경
| 항목 | 값 |
|---|---|
| AWS Profile | `rorr-dev` |
| Account | `239460481239` |
| Region | `us-east-1` |
| ECS Cluster | `mcp-agents-staging-cluster` (공유) |
| ALB | `mcp-agents-staging-alb` (공유) |

## 4. 서비스 네이밍 (확정)
| 리소스 | 값 |
|---|---|
| GitHub 레포 | `woody-rorr/backend` |
| ECR 레포 | `backend-api` |
| ECS Service | `backend-api-service` |
| ECS Task Definition | `backend-api-task` |
| Target Group | `backend-api-tg` |
| ALB 리스너 포트 | `5013` |
| 컨테이너 포트 | `5013` |
| CloudWatch 로그 그룹 | `/ecs/backend-api` |
| Task Execution Role | `ecsTaskExecutionRole` (공유) |
| Task Role | `backend-api-task` |

## 5. ALB 리스너 규칙
- 리스너 포트: TBD (위 4번 참조)
- 라우팅: path-based 없음, 해당 포트 전체를 단일 Target Group에 forward.

## 6. Swagger
- 경로: `/api-docs`
- 빌더: `DocumentBuilder().setTitle('new-project API').setVersion('1.0').addBearerAuth()`
- 운영 환경에서도 노출 (내부 ALB).

## 7. 헬스체크
- `GET /health` → `{ status: 'ok', uptime, version }`
- ECS Target Group health check path: `/health`, interval 30s, healthy threshold 2.

## 8. 빌드 / 배포
- `Dockerfile`: multi-stage (builder → runtime), `node:20-alpine`.
- 배포 스크립트: `deploy/deploy.sh` (ECR push → ECS service update).
- entrypoint에서 SSM → env 복원 (`07-env-and-secrets.md` 참조).
