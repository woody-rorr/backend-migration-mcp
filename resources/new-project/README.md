# new-project — Docs Index

> MCP/에이전트가 이 디렉토리만 읽고 NestJS API 서버를 생성할 수 있어야 합니다.
> 기존 레포 참조 금지.

## 읽기 순서
1. [00-overview.md](./00-overview.md) — 목적, 도메인 경계, non-goals
2. [01-stack-and-deploy.md](./01-stack-and-deploy.md) — NestJS / ECS / Swagger
3. [07-env-and-secrets.md](./07-env-and-secrets.md) — env 변수, SSM 경로
4. [04-data-layer.md](./04-data-layer.md) — DB 엔진, 스키마, 마이그레이션
5. [02-domain-model.md](./02-domain-model.md) — 엔티티, 불변식
6. [03-api-contract.md](./03-api-contract.md) — REST 엔드포인트
7. [06-runtime-rules.md](./06-runtime-rules.md) — guard, filter, 로깅

## 추후 추가 예정
- `05-realtime.md` — WebSocket + Redis Pub/Sub (Phase 2)

## 작성 규칙
- **Spec-first**: 코드 변경 전 .md 먼저 수정.
- `TBD` 표기된 항목은 구현 시작 전 확정 필수.
- 결정 이력은 PR description에 남길 것 (.md에는 결정된 내용만).
