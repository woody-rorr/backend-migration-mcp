# Nest.js API 서버용 Dockerfile 템플릿

`backend-migration` 레포는 Nest.js + TypeScript 기준. multi-stage build로 빌드 결과(`dist/`)만 런타임 이미지에 포함.

```dockerfile
# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build         # nest build → dist/main.js 산출

# --- runtime stage ---
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache bash jq aws-cli
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json .
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENV NODE_ENV=production
EXPOSE 5012
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
```

## 요구사항

- 베이스: `node:20-alpine` (Fargate `linux/amd64`)
- multi-stage: 빌드 결과 `dist/` 만 런타임 이미지에 포함
- `aws-cli` + `jq` 설치 (entrypoint에서 SSM 조회)
- 컨테이너 포트: 5012 (backend-migration-api)
- `npm ci` 로 lockfile 기반 정확한 의존성 설치
- `nest build` 가 `package.json scripts.build` 에 정의되어 있어야 함

## entrypoint.sh와 CMD 분리

- `ENTRYPOINT`: SSM → env 주입 (entrypoint.sh)
- `CMD`: 실제 실행 명령 (`node dist/main.js`)

entrypoint.sh 마지막에 `exec "$@"` 로 CMD 인자 실행. CMD를 변경할 때 entrypoint 안 건드려도 됨.

## 절대 금지

- ❌ `CMD ["node", "src/server.js"]` (Express 시절 패턴)
- ❌ `dist/` 없이 `src/*.ts` 만 복사 (Node가 .ts 직접 실행 불가)
- ❌ `npm install` (lockfile 무시) — 항상 `npm ci`
