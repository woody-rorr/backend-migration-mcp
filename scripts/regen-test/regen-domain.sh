#!/usr/bin/env bash
# .md만 보고 claude CLI로 도메인 코드 재생성 → output/<domain>/generated/
#
# 사용: bash scripts/regen-test/regen-domain.sh <domain>

set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "usage: $0 <domain>   e.g. follow / quiz / spark" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROMPTS_DIR="$REPO_ROOT/prompts/api"
DOMAIN_DIR="$PROMPTS_DIR/domains/$DOMAIN"
SHARED_DIR="$PROMPTS_DIR/_shared"

if [[ ! -d "$DOMAIN_DIR" ]]; then
  echo "✖ 도메인 폴더 없음: $DOMAIN_DIR" >&2
  exit 1
fi

OUT_DIR="$SCRIPT_DIR/output/$DOMAIN"
mkdir -p "$OUT_DIR/generated"

PROMPT_FILE="$OUT_DIR/prompt.txt"
OUTPUT_FILE="$OUT_DIR/claude-output.md"

cat > "$PROMPT_FILE" <<'EOF'
당신은 backend-migration 레포에 신규 Express 도메인을 추가하는 마이그레이션 개발자입니다.

아래 .md 문서들이 **유일한 명세서**입니다. origin Lambda 코드는 보지 않습니다.
명세만 보고 다음 파일들을 생성하세요:

- src/domains/<domain>/routes.js      (Express Router + @swagger JSDoc)
- src/domains/<domain>/handler.js     (req/res 처리)
- (필요 시) src/domains/<domain>/service.js
- (필요 시) src/domains/<domain>/repository.js
- (필요 시) src/domains/<domain>/schemas.js

규칙:
1. 파일명은 정확히 routes.js / handler.js (다른 이름 금지)
2. ESM. import는 상대경로 + .js 확장자 필수
3. 각 라우트 위에 @swagger JSDoc 블록 필수
4. 비즈니스 로직 디테일이 .md에 "원본 Services 1:1 이식"으로만 명시된 경우, 함수 시그니처와 기본 골격만 채우고 본문은 `// TODO: porting Origin <함수명>` 주석으로 표시
5. 응답은 `{ resultCode, resultMsg, data }` 포맷 사용
6. 출력은 다음과 같은 markdown 코드 블록 형태로 파일 단위:

   ## src/domains/<domain>/routes.js
   ```js
   ...코드...
   ```

   ## src/domains/<domain>/handler.js
   ```js
   ...코드...
   ```

   ... (필요한 만큼)

다른 설명은 최소화하고 코드 블록 위주로 응답하세요.
EOF

echo "▶ 도메인 = $DOMAIN" >&2
echo "▶ .md 파일 첨부:" >&2

# claude CLI는 --append-system-prompt 또는 stdin으로 컨텍스트 받음.
# 가장 단순한 호출: .md 내용을 모두 prompt 본문에 concat.
{
  cat "$PROMPT_FILE"
  echo
  echo "=================== _shared 공통 규칙 ==================="
  for f in "$SHARED_DIR"/*.md; do
    echo
    echo "----- $(basename "$f") -----"
    cat "$f"
  done
  echo
  echo "=================== $DOMAIN 도메인 명세 ==================="
  for f in overview.md endpoints.md business-rules.md; do
    if [[ -f "$DOMAIN_DIR/$f" ]]; then
      echo
      echo "----- $f -----"
      cat "$DOMAIN_DIR/$f"
    fi
  done
} > "$OUT_DIR/full-prompt.txt"

echo "▶ claude CLI 호출 (비대화형, full-prompt.txt 입력)" >&2

if ! command -v claude >/dev/null 2>&1; then
  echo "✖ claude CLI 미설치. https://github.com/anthropics/claude-code 참고" >&2
  exit 1
fi

# -p / --print: 비대화형. 응답을 stdout으로 받음.
cat "$OUT_DIR/full-prompt.txt" | claude -p > "$OUTPUT_FILE"

echo "▶ 응답 저장: $OUTPUT_FILE" >&2

# claude-output.md 에서 ```js 코드 블록을 파싱해 generated/ 에 파일별로 저장
node "$SCRIPT_DIR/parse-output.mjs" "$OUTPUT_FILE" "$OUT_DIR/generated"

echo
echo "✅ 생성 완료"
echo "   파일: $OUT_DIR/generated/"
ls "$OUT_DIR/generated"
echo
echo "다음: bash scripts/regen-test/compare.sh $DOMAIN"
