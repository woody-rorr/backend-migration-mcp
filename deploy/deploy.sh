#!/bin/bash
set -e
export AWS_PROFILE=${AWS_PROFILE:-rorr-dev}
REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI=${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/backend-migration-mcp
CLUSTER=mcp-agents-staging-cluster
SERVICE=backend-migration-mcp-service

cd "$(dirname "$0")/.."

echo "🔨 Build & push (linux/amd64)"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI
docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t "$ECR_URI:latest" --push .

echo "🚀 Force new deployment"
aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment --region $REGION > /dev/null

echo "⏳ Waiting for stable..."
aws ecs wait services-stable --cluster $CLUSTER --services $SERVICE --region $REGION

echo "✅ Done (MCP port 5011)"
