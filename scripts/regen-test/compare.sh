#!/usr/bin/env bash
# 생성된 코드 vs 실제 backend-migration/src/domains/<domain>/ diff
#
# 사용: bash scripts/regen-test/compare.sh <domain>

set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "usage: $0 <domain>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GEN_DIR="$SCRIPT_DIR/output/$DOMAIN/generated"
DIFF_FILE="$SCRIPT_DIR/output/$DOMAIN/diff.txt"

BACKEND_MIGRATION_REPO="${BACKEND_MIGRATION_REPO:-/Users/pinetech/Desktop/mcp/backend-migration}"
ACTUAL_DIR="$BACKEND_MIGRATION_REPO/src/domains/$DOMAIN"

if [[ ! -d "$GEN_DIR" ]]; then
  echo "✖ 생성물 없음: $GEN_DIR" >&2
  echo "  먼저 regen-domain.sh 실행하세요." >&2
  exit 1
fi
if [[ ! -d "$ACTUAL_DIR" ]]; then
  echo "✖ 실제 코드 없음: $ACTUAL_DIR" >&2
  echo "  BACKEND_MIGRATION_REPO 환경변수 확인" >&2
  exit 1
fi

echo "▶ 비교"
echo "  generated: $GEN_DIR"
echo "  actual   : $ACTUAL_DIR"
echo

{
  echo "# regen vs actual diff — domain=$DOMAIN"
  echo "# generated: $GEN_DIR"
  echo "# actual:    $ACTUAL_DIR"
  echo "# $(date)"
  echo
  echo "## 파일 목록 비교"
  diff <(ls "$GEN_DIR" | sort) <(ls "$ACTUAL_DIR" | sort) || true
  echo
  echo "## 파일별 diff"
  for f in $(ls "$GEN_DIR"); do
    if [[ -f "$ACTUAL_DIR/$f" ]]; then
      echo
      echo "### $f"
      diff -u "$ACTUAL_DIR/$f" "$GEN_DIR/$f" || true
    fi
  done
} | tee "$DIFF_FILE"

echo
echo "✅ diff 저장: $DIFF_FILE"
echo
echo "평가: scripts/regen-test/README.md § 평가 기준 참조"
