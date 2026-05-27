#!/usr/bin/env bash
# Claude OAuth 토큰을 macOS Keychain → SSM(/backend-migration-mcp/claude-credentials)에 업로드하고
# backend-migration-mcp ECS 서비스를 force-new-deployment.
#
# 전제:
#   1. 사전에 로컬에서 `claude`를 한 번 실행해 OAuth 갱신을 완료한 상태일 것.
#   2. AWS profile `rorr-dev` 설정 (account 239460481239).
#
# 사용:
#   bash scripts/refresh-claude-token.sh

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-rorr-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CLUSTER="${ECS_CLUSTER:-mcp-agents-staging-cluster}"
SERVICE="${ECS_SERVICE:-backend-migration-mcp-service}"
SSM_PATH="${SSM_PATH:-/backend-migration-mcp/claude-credentials}"

export AWS_PROFILE AWS_REGION

echo "▶ AWS account 확인"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "  → $ACCOUNT (profile=$AWS_PROFILE region=$AWS_REGION)"
if [[ "$ACCOUNT" != "239460481239" ]]; then
  echo "✖ 잘못된 계정. rorr-dev (239460481239)에 로그인되어 있어야 합니다." >&2
  exit 1
fi

echo "▶ Keychain에서 Claude credentials 읽기"
CREDS=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null || true)
if [[ -z "$CREDS" ]]; then
  echo "✖ Keychain에 'Claude Code-credentials' 항목이 없습니다." >&2
  echo "  먼저 로컬에서 'claude' 한번 실행해 로그인하세요." >&2
  exit 1
fi

EXPIRES_AT=$(echo "$CREDS" | python3 -c 'import json,sys; print(json.load(sys.stdin)["claudeAiOauth"]["expiresAt"])' 2>/dev/null || echo "")
if [[ -n "$EXPIRES_AT" ]]; then
  NOW_MS=$(($(date +%s) * 1000))
  if (( EXPIRES_AT < NOW_MS )); then
    echo "✖ Keychain의 토큰이 이미 만료되었습니다 (expiresAt=$EXPIRES_AT)." >&2
    echo "  로컬에서 'claude' 한번 실행해 OAuth 갱신 후 다시 시도하세요." >&2
    exit 1
  fi
  echo "  → expiresAt=$EXPIRES_AT (유효)"
fi

echo "▶ SSM put-parameter: $SSM_PATH"
aws ssm put-parameter \
  --name "$SSM_PATH" \
  --type SecureString \
  --value "$CREDS" \
  --overwrite \
  --region "$AWS_REGION" \
  --query '{Version:Version,Tier:Tier}' \
  --output table

echo "▶ ECS update-service: $SERVICE (force-new-deployment)"
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --region "$AWS_REGION" \
  --query 'service.{name:serviceName,td:taskDefinition,desired:desiredCount}' \
  --output table

echo "▶ 배포 진행 상태 (스냅샷)"
aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[0].deployments[0].{status:status,rollout:rolloutState,running:runningCount,desired:desiredCount}' \
  --output table

echo "✅ 완료. 2~3분 후 MCP 호출 재시도하세요."
echo "   상태 재확인:"
echo "   aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $AWS_REGION --query 'services[0].deployments[0].rolloutState'"
