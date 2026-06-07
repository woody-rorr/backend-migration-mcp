# scopes/migrate-runner — 마이그레이션 분리 산출 (Critical)

앱 부팅과 마이그레이션을 분리해 **마이그레이션 실패에도 앱은 계속 운영** 하도록 하는 인프라 산출. 관측 사례: 2026-06-07 comments PR #68 — 마이그레이션 1개 FK 실패 → 컨테이너 무한 재시작 → ALB 가 이전 task 만 살림 → 신규 코드 미반영.

## 0. 사전 점검
`common/precheck.md` 1~3 단계만 (인프라 산출).

## 1. 산출 파일 (3개)

### 1.1 `deploy/entrypoint.sh` — 마이그레이션 제거
```bash
#!/bin/sh
set -e
exec npm run start:prod
```
- **절대 `migration:run` 호출 금지.** 앱 컨테이너는 마이그레이션 책임 없음.
- 기존 `RUN_MIGRATIONS=true` 패턴(`db_migration.md` §6 deprecated)을 대체.

### 1.2 `deploy/migrate-task-def.json` — 마이그레이션 전용 ECS task definition
```json
{
  "family": "backend-api-migrate-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::239460481239:role/backend-api-execution",
  "taskRoleArn": "arn:aws:iam::239460481239:role/backend-api-task",
  "containerDefinitions": [
    {
      "name": "migrate",
      "image": "239460481239.dkr.ecr.us-east-1.amazonaws.com/backend-api:latest",
      "essential": true,
      "command": ["npm", "run", "migration:run:prod"],
      "secrets": [
        { "name": "DB_HOST", "valueFrom": "arn:aws:ssm:us-east-1:239460481239:parameter/backend-api/db-host" },
        { "name": "DB_PORT", "valueFrom": "arn:aws:ssm:us-east-1:239460481239:parameter/backend-api/db-port" },
        { "name": "DB_NAME", "valueFrom": "arn:aws:ssm:us-east-1:239460481239:parameter/backend-api/db-name" },
        { "name": "DB_USER", "valueFrom": "arn:aws:ssm:us-east-1:239460481239:parameter/backend-api/db-user" },
        { "name": "DB_PASS", "valueFrom": "arn:aws:ssm:us-east-1:239460481239:parameter/backend-api/db-pass" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/backend-api-migrate",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "migrate"
        }
      }
    }
  ]
}
```
- **앱 task def 와 동일 이미지** — `command` 만 `migration:run:prod` 으로 오버라이드.
- `essential: true` — 종료 시 exitCode 가 task 결과에 반영되어 GH Actions 에서 감지 가능.
- `DB_*` secrets 는 앱 task def 와 같은 SSM 경로 재사용.
- CloudWatch 로그 그룹은 분리 (`/ecs/backend-api-migrate`) — 마이그레이션 히스토리 별도 추적.

### 1.3 `.github/workflows/deploy.yml` — 마이그레이션 선행 실행
build · push 단계 후, `aws ecs update-service` **전에** 다음 순서 추가:

```yaml
- name: Register migrate task definition
  id: register-migrate
  run: |
    TASK_DEF_ARN=$(aws ecs register-task-definition \
      --cli-input-json file://deploy/migrate-task-def.json \
      --region ${{ env.AWS_REGION }} \
      --query 'taskDefinition.taskDefinitionArn' --output text)
    echo "task_def_arn=$TASK_DEF_ARN" >> $GITHUB_OUTPUT

- name: Run database migration
  id: run-migrate
  run: |
    TASK_ARN=$(aws ecs run-task \
      --cluster ${{ env.CLUSTER }} \
      --task-definition ${{ steps.register-migrate.outputs.task_def_arn }} \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[${{ secrets.ECS_SUBNETS }}],securityGroups=[${{ secrets.ECS_SECURITY_GROUPS }}],assignPublicIp=ENABLED}" \
      --region ${{ env.AWS_REGION }} \
      --query 'tasks[0].taskArn' --output text)
    echo "task_arn=$TASK_ARN" >> $GITHUB_OUTPUT

- name: Wait for migration to complete
  run: |
    aws ecs wait tasks-stopped \
      --cluster ${{ env.CLUSTER }} \
      --tasks ${{ steps.run-migrate.outputs.task_arn }} \
      --region ${{ env.AWS_REGION }}

    EXIT_CODE=$(aws ecs describe-tasks \
      --cluster ${{ env.CLUSTER }} \
      --tasks ${{ steps.run-migrate.outputs.task_arn }} \
      --region ${{ env.AWS_REGION }} \
      --query 'tasks[0].containers[0].exitCode' --output text)

    if [ "$EXIT_CODE" != "0" ]; then
      echo "::error::Migration failed with exit code $EXIT_CODE"
      echo "⚠️ 앱 배포 중단 — 기존 버전은 계속 운영"
      exit 1
    fi

- name: Force new app deployment
  run: |
    aws ecs update-service \
      --cluster ${{ env.CLUSTER }} \
      --service ${{ env.SERVICE }} \
      --force-new-deployment \
      --region ${{ env.AWS_REGION }} > /dev/null
```

## 2. 핵심 효과
| 시나리오 | 기존 (앱 부팅에 마이그레이션 매우임) | 분리 후 |
|---|---|---|
| 마이그레이션 성공 | 앱 교체 완료 | 같음 |
| 마이그레이션 실패 | 컨테이너 무한 재시작 → 서비스 이상 잔존 → 사용자가 추후 발견 | **앱 이전 버전 계속 운영** + GH Actions 즉시 fail 알림 |
| 롤백 필요 | 앞서 죽은 앱 도 같이 이전으로 | 앱은 건들 필요 없음, migrate task 만 재실행 |

## 3. 호출 귀칙
- **신규 레포(`bootstrap`) 시 자동 동반 산출 권장** — `bootstrap` scope 가 끝나면 `todo: ["next: migrate-runner"]` 기록.
- **기존 레포 적용** — 사용자가 명시적으로 `migrate-runner` scope 호출한 경우만. 자동 마이그레이션 분리는 entrypoint.sh 변경이 수반되므로 운영 승인 필요.

## 4. precheck 특이 검증
- target 레포에 기존 `deploy/entrypoint.sh` 가 `migration:run` 을 포함하는지 확인. 포함하면 `todo: ["warn: entrypoint.sh 의 migration:run 제거됨 — 운영 승인 필요"]` 함께 응답.
- target 레포에 이미 `deploy/migrate-task-def.json` 이 있으면 중복 생성 금지 → `todo: ["spec-fix: migrate-task-def.json 이미 존재 — modify scope 사용"]`.

## 5. 의존 secrets / env (GH Actions)
repository secrets 에 다음 추가 필요 (운영자 수동 설정):
- `ECS_SUBNETS` — 콤마 구분 subnet ID 목록
- `ECS_SECURITY_GROUPS` — 콤마 구분 SG ID 목록

`bootstrap` scope 주석에 이 요구사항 명시 필요.
