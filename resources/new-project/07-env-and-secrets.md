# Env & Secrets

## 1. 환경 변수 표
| 변수 | 필수 | 예시 | 출처 | 설명 |
|---|---|---|---|---|
| `NODE_ENV` | Y | `production` | task-def | |
| `PORT` | Y | `5013` | task-def | `01-stack-and-deploy.md` 포트 결정과 일치 |
| `LOG_LEVEL` | N | `info` | task-def | `debug`/`info`/`warn`/`error` |
| `CORS_ORIGINS` | N | `https://app.example.com` | task-def | comma-separated |
| `DB_HOST` | Y | `<rds-endpoint>` | SSM | |
| `DB_PORT` | Y | `5432` | task-def | |
| `DB_NAME` | Y | `new_project` | task-def | |
| `DB_USER` | Y | `app` | SSM | |
| `DB_PASSWORD` | Y | `***` | SSM SecureString | |
| `DB_SSL` | N | `true` | task-def | RDS 권장 |
| `JWT_SECRET` | Y | `***` | SSM SecureString | HS256 사용 시 |
| `JWT_PUBLIC_KEY` | (RS) | `-----BEGIN...` | SSM SecureString | RS256 사용 시 |
| `JWT_EXPIRES_IN` | N | `1h` | task-def | |
| `RUN_MIGRATIONS` | N | `false` | task-def | 자동 마이그레이션 여부 |

## 2. SSM 파라미터 경로
- `/new-project-api/db-host` (SecureString)
- `/new-project-api/db-user` (SecureString)
- `/new-project-api/db-password` (SecureString)
- `/new-project-api/jwt-secret` (SecureString)
- (필요 시 추가)

## 3. 로딩 전략
- NestJS: `@nestjs/config` + `joi` 스키마 검증.
- 부팅 시 필수 변수 누락 → **즉시 throw하여 컨테이너 죽임** (silent default 금지).
- ECS task-def는 `secrets` 필드로 SSM 직접 매핑 권장 (entrypoint에서 복원 X).

```json
"secrets": [
  { "name": "DB_PASSWORD", "valueFrom": "arn:aws:ssm:us-east-1:239460481239:parameter/new-project-api/db-password" }
]
```

## 4. 로컬 개발
- `.env.example` 레포에 커밋, `.env`는 gitignore.
- `direnv` 또는 `dotenv` 사용.
- 로컬 DB: docker-compose로 PostgreSQL 띄우기 (옵션 — TBD).

## 5. 시크릿 회전
- DB password: RDS 자동 회전 미사용 시 분기별 수동 회전.
- JWT secret 회전 시 **기존 토큰 무효화**되므로 사전 공지 필요.
