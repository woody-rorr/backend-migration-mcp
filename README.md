# backend-migration-mcp

Lambda → ECS Express 코드 마이그레이션 MCP 서버.

## 빠른 시작

```bash
npm install
PORT=5011 npm start
```

자세한 운영 가이드는 [CLAUDE.md](./CLAUDE.md) 참조.

## 툴

- `analyze_lambda_project`
- `convert_handlers`
- `generate_docker_assets`

## 인증

Claude OAuth만 사용 (SSM Parameter Store에 저장된 `~/.claude/.credentials.json`).

<!-- CI smoke test 1779351908 -->
