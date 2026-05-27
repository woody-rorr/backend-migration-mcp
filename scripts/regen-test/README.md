# 재생성 검증 (.md → 코드 → diff)

## 목표

`prompts/api/domains/<domain>/*.md` 와 `prompts/api/_shared/*.md` 만 주고
`claude` CLI에게 `src/domains/<domain>/{routes,handler}.js` 를 생성시킨 뒤,
실제 `backend-migration` 레포의 같은 파일과 `diff` 해서 **재현 가능성을 측정**합니다.

차이가 작을수록 .md가 충분히 결정론적. 차이가 크면 .md를 보강할 단서.

## 전제

- 로컬에 `claude` CLI 설치 + OAuth 로그인 (`security find-generic-password -s "Claude Code-credentials"` 통과)
- `BACKEND_MIGRATION_REPO` 환경변수 = `backend-migration` 레포 절대 경로
  (기본: `/Users/pinetech/Desktop/mcp/backend-migration`)

## 사용

```bash
# 1) 도메인 코드 생성 (claude CLI가 .md만 보고 작성)
bash scripts/regen-test/regen-domain.sh follow

# 2) 실제 backend-migration 코드와 비교
bash scripts/regen-test/compare.sh follow

# 3) 결과는 scripts/regen-test/output/<domain>/ 에 누적 (gitignore)
```

## 출력물

```
scripts/regen-test/output/<domain>/
├── prompt.txt          ← claude에 넣은 프롬프트 전문 (재현용)
├── claude-output.md    ← claude 응답 원본 (코드 블록 포함)
├── generated/          ← 응답에서 파싱한 파일들 (routes.js, handler.js 등)
└── diff.txt            ← compare.sh 결과
```

## 평가 기준

- **PASS**: routes path/메서드, handler 함수 시그니처, 응답 필드명이 일치
- **소소한 차이는 OK**: 변수명, 주석, import 순서, 미들웨어 함수명
- **FAIL 신호**:
  - 엔드포인트 누락/추가
  - 응답 필드/타입 불일치
  - 검증 메시지/에러 코드명 변경
  - 비즈니스 룰 변경 (정렬, 페이지 알고리즘, 멱등성 키 등)

FAIL이 나오면 → 해당 룰을 `business-rules.md`에 R번호로 추가.

## 주의

이 셋업은 **명세서 품질 검증용**이지 실제 마이그레이션 생성기가 아닙니다.
실제 마이그레이션은 `convert_handlers` MCP 툴이 origin 코드를 함께 참조해 수행.
