#!/bin/bash

###############################################################################
# TSF ERP System - VPS Deployment Script (PM2 + Nginx)
# Version: 1.0.0
# Description: Automated deployment to VPS using PM2 and Nginx
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_SERVER="${DEPLOY_SERVER:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/tsf-frontend}"
DEPLOYMENT_ENV="${1:-production}"
BRANCH="${2:-main}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    TSF ERP - VPS Deployment Script    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Validate configuration
if [ -z "$DEPLOY_SERVER" ]; then
    echo -e "${RED}✗ DEPLOY_SERVER environment variable not set${NC}"
    echo "Example: export DEPLOY_SERVER='user@your-server.com'"
    exit 1
fi

# Step 1: Pre-deployment checks
echo -e "${YELLOW}[1/10]${NC} Running pre-deployment checks..."

# Check SSH connection
echo "  → Testing SSH connection to ${DEPLOY_SERVER}..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 "${DEPLOY_SERVER}" echo "OK" > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ SSH connection successful${NC}"
else
    echo -e "${RED}    ✗ Cannot connect to ${DEPLOY_SERVER}${NC}"
    echo "    Make sure SSH keys are set up correctly"
    exit 1
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

# Step 2: Local tests
echo -e "${YELLOW}[2/10]${NC} Running local tests..."

# TypeScript check
echo "  → Running TypeScript check..."
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ TypeScript check passed${NC}"
else
    echo -e "${RED}    ✗ TypeScript check failed${NC}"
    exit 1
fi

# Business logic tests
echo "  → Running tests..."
if npm run test > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ Tests passed${NC}"
else
    echo -e "${YELLOW}    ⚠ Some tests failed (continuing anyway)${NC}"
fi

echo -e "${GREEN}✓ Local tests completed${NC}"
echo ""

# Step 3: Git operations
echo -e "${YELLOW}[3/10]${NC} Preparing Git deployment..."

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠ You have uncommitted changes${NC}"
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

# Push to remote
echo "  → Pushing to remote..."
git push origin "$BRANCH"

echo -e "${GREEN}✓ Git operations complete${NC}"
echo ""

# Step 4: Backup current deployment
echo -e "${YELLOW}[4/10]${NC} Creating backup on server..."

BACKUP_NAME="backup-$(date +%Y%m%d_%H%M%S)"

ssh "${DEPLOY_SERVER}" << EOF
    if [ -d "${DEPLOY_PATH}" ]; then
        echo "  → Creating backup: ${BACKUP_NAME}"
        sudo cp -r "${DEPLOY_PATH}" "${DEPLOY_PATH}-${BACKUP_NAME}"
        echo "  ✓ Backup created"
    else
        echo "  → No existing deployment found, skipping backup"
    fi
EOF

echo -e "${GREEN}✓ Backup complete${NC}"
echo ""

# Step 5: Pull latest code on server
echo -e "${YELLOW}[5/10]${NC} Pulling latest code on server..."

ssh "${DEPLOY_SERVER}" << EOF
    set -e

    # Create directory if it doesn't exist
    if [ ! -d "${DEPLOY_PATH}" ]; then
        echo "  → Creating deployment directory..."
        sudo mkdir -p "${DEPLOY_PATH}"
        sudo chown -R ${DEPLOY_USER}:${DEPLOY_USER} "${DEPLOY_PATH}"

        echo "  → Cloning repository..."
        cd "${DEPLOY_PATH}"
        git clone . "${DEPLOY_PATH}"
    fi

    cd "${DEPLOY_PATH}"

    echo "  → Fetching latest changes..."
    git fetch origin

    echo "  → Checking out ${BRANCH}..."
    git checkout "${BRANCH}"

    echo "  → Pulling latest code..."
    git pull origin "${BRANCH}"

    echo "  ✓ Code updated to commit: \$(git rev-parse --short HEAD)"
EOF

echo -e "${GREEN}✓ Code pulled successfully${NC}"
echo ""

# Step 6: Install dependencies
echo -e "${YELLOW}[6/10]${NC} Installing dependencies on server..."

ssh "${DEPLOY_SERVER}" << 'EOF'
    set -e
    cd "${DEPLOY_PATH}"

    echo "  → Installing npm dependencies..."
    npm ci --production

    echo "  ✓ Dependencies installed"
EOF

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 7: Build application
echo -e "${YELLOW}[7/10]${NC} Building application on server..."

ssh "${DEPLOY_SERVER}" << 'EOF'
    set -e
    cd "${DEPLOY_PATH}"

    echo "  → Building Next.js application..."
    npm run build

    echo "  ✓ Build complete"
EOF

echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 8: Update PM2 process
echo -e "${YELLOW}[8/10]${NC} Updating PM2 process..."

ssh "${DEPLOY_SERVER}" << 'EOF'
    set -e
    cd "${DEPLOY_PATH}"

    # Check if PM2 process exists
    if pm2 describe tsf-frontend > /dev/null 2>&1; then
        echo "  → Reloading PM2 process..."
        pm2 reload tsf-frontend --update-env
    else
        echo "  → Starting new PM2 process..."
        pm2 start ecosystem.config.js
    fi

    # Save PM2 configuration
    pm2 save

    echo "  ✓ PM2 process updated"
EOF

echo -e "${GREEN}✓ PM2 process updated${NC}"
echo ""

# Step 9: Reload Nginx
echo -e "${YELLOW}[9/10]${NC} Reloading Nginx..."

ssh "${DEPLOY_SERVER}" << 'EOF'
    set -e

    echo "  → Testing Nginx configuration..."
    sudo nginx -t

    echo "  → Reloading Nginx..."
    sudo systemctl reload nginx

    echo "  ✓ Nginx reloaded"
EOF

echo -e "${GREEN}✓ Nginx reloaded${NC}"
echo ""

# Step 10: Post-deployment verification
echo -e "${YELLOW}[10/10]${NC} Running post-deployment verification..."

# Wait for application to be ready
echo "  → Waiting for application to be ready..."
sleep 15

# Get server hostname/IP
SERVER_HOST=$(echo "$DEPLOY_SERVER" | cut -d@ -f2)

# Health check
echo "  → Running health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_HOST}/api/health" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}    ✓ Health check passed${NC}"
else
    echo -e "${YELLOW}    ⚠ Health check returned status: $HTTP_STATUS${NC}"
fi

# Check homepage
echo "  → Checking homepage..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_HOST}/" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}    ✓ Homepage loads successfully${NC}"
else
    echo -e "${RED}    ✗ Homepage returned status: $HTTP_STATUS${NC}"
fi

# Check PM2 status
echo "  → Checking PM2 status..."
ssh "${DEPLOY_SERVER}" "pm2 list | grep tsf-frontend"

echo ""
echo -e "${GREEN}✓ Post-deployment verification complete${NC}"
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Deployment Summary               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "  Server: ${DEPLOY_SERVER}"
echo "  Path: ${DEPLOY_PATH}"
echo "  Branch: ${BRANCH}"
echo "  Commit: ${CURRENT_COMMIT}"
echo "  Backup: ${BACKUP_NAME}"
echo ""
echo -e "${GREEN}✓ VPS deployment complete!${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:      ssh ${DEPLOY_SERVER} 'pm2 logs tsf-frontend'"
echo "  Restart app:    ssh ${DEPLOY_SERVER} 'pm2 restart tsf-frontend'"
echo "  Check status:   ssh ${DEPLOY_SERVER} 'pm2 status'"
echo "  Rollback:       ssh ${DEPLOY_SERVER} 'sudo rm -rf ${DEPLOY_PATH} && sudo mv ${DEPLOY_PATH}-${BACKUP_NAME} ${DEPLOY_PATH} && pm2 restart tsf-frontend'"
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
