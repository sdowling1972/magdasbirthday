#!/usr/bin/env bash
# One-time / phased AWS bootstrap for Magda's Big Birthday.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INFRA="$ROOT/infra"
REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-magdasbirthday}"

need() { command -v "$1" >/dev/null || { echo "Missing: $1"; exit 1; }; }
need aws
need terraform
need docker
need jq

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS credentials not configured. Run: aws configure"
  exit 1
fi

ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -d '=+/')}"
export TF_VAR_admin_password="$ADMIN_PASSWORD"

cd "$INFRA"
terraform init -input=false

echo "==> Phase 1: core infra (S3, ECR, RDS, IAM) — no App Runner / CloudFront yet"
terraform apply -input=false -auto-approve \
  -var="enable_apprunner=false" \
  -var="api_origin_domain="

ECR=$(terraform output -raw ecr_repository_url)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "==> Building and pushing API image to $ECR"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
docker build -t "$ECR:latest" "$ROOT/backend"
docker push "$ECR:latest"

echo "==> Phase 2: App Runner"
terraform apply -input=false -auto-approve \
  -var="enable_apprunner=true" \
  -var="api_origin_domain="

API_URL=$(terraform output -raw apprunner_service_url)
API_HOST="${API_URL#https://}"
echo "Waiting for App Runner to become RUNNING..."
ARN=$(terraform output -raw apprunner_service_arn)
for i in $(seq 1 60); do
  STATUS=$(aws apprunner describe-service --service-arn "$ARN" --query 'Service.Status' --output text)
  echo "  status=$STATUS"
  [[ "$STATUS" == "RUNNING" ]] && break
  sleep 15
done

echo "==> Phase 3: CloudFront"
terraform apply -input=false -auto-approve \
  -var="enable_apprunner=true" \
  -var="api_origin_domain=$API_HOST"

FRONTEND_BUCKET=$(terraform output -raw frontend_bucket)
CF_DOMAIN=$(terraform output -raw cloudfront_domain_name)
CF_ID=$(terraform output -raw cloudfront_distribution_id)

echo "==> Building and uploading frontend"
(cd "$ROOT/frontend" && npm ci && npm run build)
aws s3 sync "$ROOT/frontend/dist" "s3://$FRONTEND_BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*" >/dev/null

DEPLOY_KEY=$(terraform output -raw deploy_access_key_id)
DEPLOY_SECRET=$(terraform output -raw deploy_secret_access_key)

echo
echo "======== DEPLOYMENT COMPLETE ========"
echo "CloudFront: https://$CF_DOMAIN"
echo "App Runner: $API_URL"
echo "Admin password: $ADMIN_PASSWORD"
echo
echo "Cloudflare DNS (proxied):"
echo "  CNAME  @    $CF_DOMAIN"
echo "  CNAME  www  $CF_DOMAIN"
echo "  SSL/TLS mode: Full"
echo
echo "Add these GitHub Actions secrets (repo Settings → Secrets):"
echo "  AWS_ACCESS_KEY_ID=$DEPLOY_KEY"
echo "  AWS_SECRET_ACCESS_KEY=$DEPLOY_SECRET"
echo
echo "Save the admin password somewhere safe."
terraform output -json > "$INFRA/outputs.json"
echo "Wrote $INFRA/outputs.json"
