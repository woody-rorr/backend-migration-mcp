# new-project — Overview

> 이 문서는 **MCP/에이전트가 코드를 처음부터 생성**하기 위한 진입점입니다.
> 기존 레포(`backend-lol-api-v3_origin`, `backend-migration`)는 **참조하지 않습니다.**
> 모든 결정은 `docs/` 하위 .md 파일에서 자기완결적으로 정의됩니다.

## 1. 목적
<!-- 이 프로젝트가 해결하는 문제 1~3줄로 작성 -->
- TBD

## 2. 도메인 경계
<!-- 이 서비스가 책임지는 것 / 책임지지 않는 것 명시 -->
**In scope**
- TBD

**Out of scope (Non-goals)**
- 기존 LoL API 도메인과의 통합 (별도 서비스)
- 실시간 소켓 (Phase 2에서 `05-realtime.md`로 추가)

## 3. 용어집
| 용어 | 정의 |
|---|---|
| TBD | TBD |

## 4. 작성 순서 (MCP가 읽는 순서)
1. `00-overview.md` (현재 파일) — 무엇/왜
2. `01-stack-and-deploy.md` — 스택과 배포 환경
3. `07-env-and-secrets.md` — 환경 변수 / SSM 경로
4. `04-data-layer.md` — DB 스키마
5. `02-domain-model.md` — 엔티티 / 불변식
6. `03-api-contract.md` — REST 엔드포인트 명세
7. `06-runtime-rules.md` — guard / interceptor / 에러 / 로깅

## 5. 변경 정책
- **Spec-first**: 코드보다 .md를 먼저 머지.
- 구현이 .md와 어긋나면 **.md를 먼저 수정**한 뒤 코드 반영.
- PR 제목 prefix: `[docs/new-project]` 또는 `[new-project]`.
