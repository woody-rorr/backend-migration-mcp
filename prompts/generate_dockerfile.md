# Express API 서버용 Dockerfile 템플릿

```dockerfile
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    awscli ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
COPY deploy/entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 5012
CMD ["/bin/sh", "/app/entrypoint.sh"]
```

## 요구사항

- 베이스: `node:20-bookworm-slim` (Fargate `linux/amd64`)
- `awscli` 설치 (entrypoint에서 SSM 조회)
- 컨테이너 포트: 5012 (backend-migration-api)
- production 의존성만 설치
