# API 구현 가이드 (인덱스)

본 디렉토리는 `backend-migration` 레포의 **API 라우터 + 비즈니스 로직** 작성 규칙을 도메인 단위로 정리한 곳입니다. `convert_handlers` / 신규 엔드포인트 추가 시 LLM이 이 문서들을 읽고 코드를 생성합니다.

> ⭐ **재현 원칙**: 도메인별 .md 3종(`overview`/`endpoints`/`business-rules`)만 보고 `src/domains/<domain>/` 를 통째로 다시 생성해도 **API 계약 + 비즈니스 동작이 동일**해야 합니다. 누락된 동작/엣지 케이스 발견 시 코드보다 .md를 먼저 갱신.

## 구조

```
prompts/api/
├── README.md                          ← 이 문서 (인덱스)
├── _shared/                           ← 모든 도메인 공통 규칙
│   ├── business-logic.md              핸들러/서비스 분리, 트랜잭션 경계
│   ├── response-format.md             성공/실패 응답 스키마
│   ├── error-handling.md              에러 분류 + next(err) 위임
│   ├── validation.md                  req 입력 검증 (zod 권장)
│   ├── db-access.md                   pool 사용, repository 패턴
│   ├── auth-context.md                req.user 주입 / 권한 분기
│   └── transaction.md                 멀티-쿼리 원자성
└── domains/                          ← 각 폴더에 overview/endpoints/business-rules 3종
    ├── auth/         JWT 토큰 검증 (1 endpoint)
    ├── datacenter/   LoL 데이터 upsert (어드민/배치, 7)
    ├── donation/     선수/팀 부스트·후원 + spark 지급 (8 활성)
    ├── event/        ai_game_commentary 이벤트 페이지 (1)
    ├── extension/    Live2D 캐릭터 manifest + S3 업로드 URL (2)
    ├── follow/       리그/팀/선수 팔로우 (6)
    ├── mainfeed/     메인 피드 + 좋아요 (2)
    ├── msgboxes/     쪽지함 (4)
    ├── payment/      Xsolla/Toss 결제 (4)
    ├── players/      선수 set (1)
    ├── quiz/         퀴즈 픽/스트릭/캘린더 HTTP (7, MSK/소켓 제외)
    ├── ranking/      월별 랭킹 (3)
    ├── sample/       레퍼런스 placeholder
    ├── schedules/    LoL 일정 조회 (5)
    ├── search/       리그/팀/선수 통합 검색 (1)
    ├── spark/        잔액/거래/보상 (5)
    ├── systemMsg/    Teams webhook 알림 (1)
    ├── teams/        팀 set/get (2)
    ├── uploader/     S3 presigned URL (1)
    ├── users/        로그인/내정보/잔액/입금이력 (4)
    └── version/      버전별 endpoint 정보 (1)
```

## 사용 순서

1. **공통 규칙 먼저 읽기** — `_shared/*.md`는 도메인 무관 절대 규칙
2. **대상 도메인 폴더 읽기** — `domains/<domain>/overview.md` → `endpoints.md` → `business-rules.md` 순
3. **변환/생성 규칙은 `prompts/convert_handler.md`** (파일명 컨벤션, Swagger JSDoc, 부팅 안정성)

## 신규 도메인 추가 절차

1. `domains/<new>/` 폴더 생성
2. `overview.md` / `endpoints.md` / `business-rules.md` 세 파일 작성 (스켈레톤은 기존 도메인 복사)
3. 동일 PR에서 `backend-migration` 레포의 `src/domains/<new>/{routes,handler}.js` 생성 + `src/server.js`에 mount

## 우선순위 충돌 시

`_shared/` < `domains/<x>/business-rules.md` < `convert_handler.md`의 절대 규칙.
파일명/디렉토리/import 같은 **부팅 안정성** 규칙은 항상 최상위 우선.
