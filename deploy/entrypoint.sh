#!/bin/sh
set -e

REGION="${AWS_REGION:-us-east-1}"

# === Claude OAuth credentials → ~/.claude/.credentials.json ===
SSM_CLAUDE="/backend-migration-mcp/claude-credentials"
CLAUDE_DIR="${HOME:-/root}/.claude"
mkdir -p "$CLAUDE_DIR"
CREDS=$(aws ssm get-parameter --name "$SSM_CLAUDE" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
if [ -n "$CREDS" ]; then
  printf '%s' "$CREDS" > "$CLAUDE_DIR/.credentials.json"
  chmod 600 "$CLAUDE_DIR/.credentials.json"
  echo "[entrypoint] Claude OAuth credentials installed at $CLAUDE_DIR/.credentials.json"
else
  echo "[entrypoint] WARN: SSM $SSM_CLAUDE empty — claude CLI may fail to auth"
fi

# === Target repo URL (변환 PR 대상: woody-rorr/backend-migration) ===
SSM_GH_REPO="/backend-migration-mcp/github-repo-url"
REPO=$(aws ssm get-parameter --name "$SSM_GH_REPO" --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
[ -n "$REPO" ] && export MIGRATION_GITHUB_REPO_URL="$REPO" && echo "[entrypoint] MIGRATION_GITHUB_REPO_URL=$REPO"

# === Source repo PAT (piecomp/backend-lol-api-v3 read) ===
SSM_SRC_PAT="/backend-migration-mcp/github-source-token"
SRC_PAT=$(aws ssm get-parameter --name "$SSM_SRC_PAT" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
[ -n "$SRC_PAT" ] && export GITHUB_PAT="$SRC_PAT" && echo "[entrypoint] GITHUB_PAT loaded (source repo PAT)"

# GitHub 사용자 토큰(PR 대상용)은 Authorization 헤더로 ALS 전파 — 환경변수 사용 안 함.

exec node /app/src/server.js
