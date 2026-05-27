# ECS Task Definition 템플릿 (backend-migration-api)

```json
{
  "family": "backend-migration-api-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::239460481239:role/backend-migration-api-execution",
  "taskRoleArn": "arn:aws:iam::239460481239:role/backend-migration-api-task",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "239460481239.dkr.ecr.us-east-1.amazonaws.com/backend-migration-api:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 5012, "protocol": "tcp" }],
      "environment": [
        { "name": "PORT", "value": "5012" },
        { "name": "AWS_REGION", "value": "us-east-1" },
        { "name": "NODE_ENV", "value": "production" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/backend-migration-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## ALB 연결

- ALB: `mcp-agents-staging-alb` (공유)
- Listener 포트: 5012
- Target Group: `backend-migration-api-tg`
- Health check path: `/health`
