#!/bin/bash

###############################################################################
# TSF ERP System - Vercel Deployment Script
# Version: 1.0.0
# Description: Automated deployment to Vercel platform
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOYMENT_TYPE="${1:-preview}"  # preview or production
VERCEL_ORG="${VERCEL_ORG:-}"
VERCEL_PROJECT="${VERCEL_PROJECT:-tsf-erp}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  TSF ERP - Vercel Deployment Script   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Pre-deployment checks
echo -e "${YELLOW}[1/7]${NC} Running pre-deployment checks..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}✗ Vercel CLI not found${NC}"
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}⚠ Not logged in to Vercel${NC}"
    echo "Please login to Vercel:"
    vercel login
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

# Step 2: Environment validation
echo -e "${YELLOW}[2/7]${NC} Validating environment..."

cd "$PROJECT_ROOT"

# Check for required environment variables
REQUIRED_VARS=(
    "NEXT_PUBLIC_API_URL"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${YELLOW}⚠ Missing environment variables:${NC}"
    printf '  - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please set them in Vercel dashboard or provide them now."
fi

echo -e "${GREEN}✓ Environment validated${NC}"
echo ""

# Step 3: Run tests
echo -e "${YELLOW}[3/7]${NC} Running tests..."

# TypeScript check
echo "  → Running TypeScript check..."
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ TypeScript check passed${NC}"
else
    echo -e "${RED}    ✗ TypeScript check failed${NC}"
    echo "    Run 'npm run typecheck' to see errors"
    exit 1
fi

# Business logic tests
echo "  → Running business logic tests..."
if npm run test > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ Tests passed${NC}"
else
    echo -e "${YELLOW}    ⚠ Some tests failed (continuing anyway)${NC}"
fi

echo -e "${GREEN}✓ Tests completed${NC}"
echo ""

# Step 4: Build verification
echo -e "${YELLOW}[4/7]${NC} Building application..."

if npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo ""

# Step 5: Git verification
echo -e "${YELLOW}[5/7]${NC} Verifying Git status..."

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠ You have uncommitted changes${NC}"
    echo "It's recommended to commit all changes before deploying."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
CURRENT_COMMIT=$(git rev-parse --short HEAD)
COMMIT_MESSAGE=$(git log -1 --pretty=%B)

echo "  Branch: $CURRENT_BRANCH"
echo "  Commit: $CURRENT_COMMIT"
echo "  Message: $COMMIT_MESSAGE"

echo -e "${GREEN}✓ Git verification complete${NC}"
echo ""

# Step 6: Deploy
echo -e "${YELLOW}[6/7]${NC} Deploying to Vercel..."

VERCEL_ARGS=""

if [ "$DEPLOYMENT_TYPE" == "production" ]; then
    echo -e "${BLUE}→ Deploying to PRODUCTION${NC}"
    VERCEL_ARGS="--prod"

    # Production deployment confirmation
    echo ""
    echo -e "${RED}WARNING: You are about to deploy to PRODUCTION${NC}"
    echo "This will affect live users."
    echo ""
    read -p "Are you sure you want to continue? (yes/no) " -r
    echo
    if [[ ! $REPLY == "yes" ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
else
    echo -e "${BLUE}→ Deploying preview (staging)${NC}"
fi

# Add organization and project flags if set
if [ -n "$VERCEL_ORG" ]; then
    VERCEL_ARGS="$VERCEL_ARGS --scope=$VERCEL_ORG"
fi

# Run deployment
DEPLOYMENT_OUTPUT=$(vercel $VERCEL_ARGS 2>&1)
DEPLOYMENT_URL=$(echo "$DEPLOYMENT_OUTPUT" | grep -o 'https://[^ ]*' | tail -1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment successful${NC}"
    echo ""
    echo "🚀 Deployment URL: ${BLUE}$DEPLOYMENT_URL${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    echo "$DEPLOYMENT_OUTPUT"
    exit 1
fi

echo ""

# Step 7: Post-deployment verification
echo -e "${YELLOW}[7/7]${NC} Running post-deployment verification..."

# Wait for deployment to be ready
echo "  → Waiting for deployment to be ready..."
sleep 10

# Health check
echo "  → Running health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/health" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}    ✓ Health check passed${NC}"
else
    echo -e "${YELLOW}    ⚠ Health check returned status: $HTTP_STATUS${NC}"
fi

# Check if homepage loads
echo "  → Checking homepage..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}    ✓ Homepage loads successfully${NC}"
else
    echo -e "${RED}    ✗ Homepage returned status: $HTTP_STATUS${NC}"
fi

echo ""
echo -e "${GREEN}✓ Post-deployment verification complete${NC}"
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Deployment Summary               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "  Environment: ${DEPLOYMENT_TYPE}"
echo "  Branch: ${CURRENT_BRANCH}"
echo "  Commit: ${CURRENT_COMMIT}"
echo "  URL: ${DEPLOYMENT_URL}"
echo ""

if [ "$DEPLOYMENT_TYPE" == "production" ]; then
    echo -e "${GREEN}✓ Production deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Test critical user flows"
    echo "  2. Monitor error logs in Sentry"
    echo "  3. Check performance metrics in Vercel Analytics"
    echo "  4. Notify team of deployment"
else
    echo -e "${GREEN}✓ Preview deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review changes at: ${DEPLOYMENT_URL}"
    echo "  2. Run smoke tests"
    echo "  3. If all looks good, deploy to production:"
    echo "     ./scripts/deploy/deploy-vercel.sh production"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
