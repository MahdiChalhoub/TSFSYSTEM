#!/bin/bash

###############################################################################
# TSF ERP System - Rollback Script
# Version: 1.0.0
# Description: Emergency rollback for all deployment types
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_TYPE="${1:-}"
ROLLBACK_TARGET="${2:-previous}"

echo -e "${RED}╔════════════════════════════════════════╗${NC}"
echo -e "${RED}║     TSF ERP - ROLLBACK SCRIPT          ║${NC}"
echo -e "${RED}╚════════════════════════════════════════╝${NC}"
echo ""

# Show usage if no deployment type specified
if [ -z "$DEPLOYMENT_TYPE" ]; then
    echo "Usage: $0 <deployment-type> [rollback-target]"
    echo ""
    echo "Deployment types:"
    echo "  vercel    - Rollback Vercel deployment"
    echo "  docker    - Rollback Docker deployment"
    echo "  vps       - Rollback VPS/PM2 deployment"
    echo ""
    echo "Rollback targets:"
    echo "  previous  - Rollback to previous deployment (default)"
    echo "  <tag>     - Rollback to specific tag/commit"
    echo ""
    exit 1
fi

# Confirmation prompt
echo -e "${RED}⚠️  WARNING: You are about to rollback the deployment${NC}"
echo ""
echo "  Deployment type: ${DEPLOYMENT_TYPE}"
echo "  Rollback target: ${ROLLBACK_TARGET}"
echo ""
read -p "Are you absolutely sure? Type 'ROLLBACK' to confirm: " CONFIRM

if [ "$CONFIRM" != "ROLLBACK" ]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Starting rollback process...${NC}"
echo ""

###############################################################################
# VERCEL ROLLBACK
###############################################################################
if [ "$DEPLOYMENT_TYPE" == "vercel" ]; then
    echo -e "${YELLOW}[Vercel Rollback]${NC}"
    echo ""

    # Check if vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo -e "${RED}✗ Vercel CLI not found${NC}"
        exit 1
    fi

    # List recent deployments
    echo "Recent deployments:"
    vercel ls --prod | head -10
    echo ""

    if [ "$ROLLBACK_TARGET" == "previous" ]; then
        # Rollback to previous deployment
        echo "  → Rolling back to previous deployment..."
        vercel rollback

    else
        # Rollback to specific deployment
        echo "  → Rolling back to deployment: ${ROLLBACK_TARGET}..."
        vercel rollback "$ROLLBACK_TARGET"
    fi

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Vercel rollback successful${NC}"
    else
        echo -e "${RED}✗ Vercel rollback failed${NC}"
        exit 1
    fi

###############################################################################
# DOCKER ROLLBACK
###############################################################################
elif [ "$DEPLOYMENT_TYPE" == "docker" ]; then
    echo -e "${YELLOW}[Docker Rollback]${NC}"
    echo ""

    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}✗ Docker Compose not found${NC}"
        exit 1
    fi

    # List available image tags
    echo "Available images:"
    docker images tsf-frontend --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}"
    echo ""

    if [ "$ROLLBACK_TARGET" == "previous" ]; then
        # Find previous image
        PREVIOUS_TAG=$(docker images tsf-frontend --format "{{.Tag}}" | sed -n '2p')

        if [ -z "$PREVIOUS_TAG" ]; then
            echo -e "${RED}✗ No previous image found${NC}"
            exit 1
        fi

        echo "  → Rolling back to image: tsf-frontend:${PREVIOUS_TAG}..."
        ROLLBACK_TARGET="$PREVIOUS_TAG"
    else
        echo "  → Rolling back to image: tsf-frontend:${ROLLBACK_TARGET}..."
    fi

    # Update docker-compose to use rollback image
    export IMAGE_TAG="$ROLLBACK_TARGET"

    # Stop current containers
    echo "  → Stopping current containers..."
    docker-compose -f docker-compose.production.yml down

    # Start with rollback image
    echo "  → Starting containers with rollback image..."
    docker-compose -f docker-compose.production.yml up -d

    # Wait for services
    echo "  → Waiting for services to be ready..."
    sleep 15

    # Verify rollback
    if docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
        echo -e "${GREEN}✓ Docker rollback successful${NC}"
    else
        echo -e "${RED}✗ Docker rollback failed${NC}"
        docker-compose -f docker-compose.production.yml logs --tail=50
        exit 1
    fi

###############################################################################
# VPS ROLLBACK
###############################################################################
elif [ "$DEPLOYMENT_TYPE" == "vps" ]; then
    echo -e "${YELLOW}[VPS Rollback]${NC}"
    echo ""

    # Configuration
    DEPLOY_SERVER="${DEPLOY_SERVER:-}"
    DEPLOY_PATH="${DEPLOY_PATH:-/var/www/tsf-frontend}"

    if [ -z "$DEPLOY_SERVER" ]; then
        echo -e "${RED}✗ DEPLOY_SERVER environment variable not set${NC}"
        exit 1
    fi

    # List available backups
    echo "Available backups:"
    ssh "${DEPLOY_SERVER}" "ls -lt ${DEPLOY_PATH}-backup-* 2>/dev/null | head -10" || echo "No backups found"
    echo ""

    if [ "$ROLLBACK_TARGET" == "previous" ]; then
        # Find most recent backup
        BACKUP_DIR=$(ssh "${DEPLOY_SERVER}" "ls -t ${DEPLOY_PATH}-backup-* 2>/dev/null | head -1")

        if [ -z "$BACKUP_DIR" ]; then
            echo -e "${RED}✗ No backup found${NC}"
            exit 1
        fi

        echo "  → Rolling back to: ${BACKUP_DIR}..."
    else
        # Use specified backup
        BACKUP_DIR="${DEPLOY_PATH}-backup-${ROLLBACK_TARGET}"
        echo "  → Rolling back to: ${BACKUP_DIR}..."
    fi

    # Execute rollback on server
    ssh "${DEPLOY_SERVER}" << EOF
        set -e

        # Verify backup exists
        if [ ! -d "${BACKUP_DIR}" ]; then
            echo "✗ Backup directory not found: ${BACKUP_DIR}"
            exit 1
        fi

        # Stop PM2 process
        echo "  → Stopping PM2 process..."
        pm2 stop tsf-frontend || true

        # Backup current (broken) deployment
        TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
        echo "  → Backing up current deployment..."
        sudo mv "${DEPLOY_PATH}" "${DEPLOY_PATH}-broken-\${TIMESTAMP}"

        # Restore from backup
        echo "  → Restoring from backup..."
        sudo cp -r "${BACKUP_DIR}" "${DEPLOY_PATH}"
        sudo chown -R ${DEPLOY_USER:-deploy}:${DEPLOY_USER:-deploy} "${DEPLOY_PATH}"

        # Restart PM2 process
        echo "  → Restarting PM2 process..."
        cd "${DEPLOY_PATH}"
        pm2 restart tsf-frontend || pm2 start ecosystem.config.js

        # Reload Nginx
        echo "  → Reloading Nginx..."
        sudo nginx -t && sudo systemctl reload nginx

        echo "  ✓ Rollback complete"
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ VPS rollback successful${NC}"
    else
        echo -e "${RED}✗ VPS rollback failed${NC}"
        exit 1
    fi

else
    echo -e "${RED}✗ Unknown deployment type: ${DEPLOYMENT_TYPE}${NC}"
    exit 1
fi

echo ""

###############################################################################
# POST-ROLLBACK VERIFICATION
###############################################################################
echo -e "${YELLOW}Running post-rollback verification...${NC}"
echo ""

# Wait for application to stabilize
echo "  → Waiting for application to stabilize..."
sleep 10

# Determine health check URL based on deployment type
if [ "$DEPLOYMENT_TYPE" == "vercel" ]; then
    # Get production URL from Vercel
    HEALTH_URL=$(vercel ls --prod | grep "https://" | head -1 | awk '{print $2}')
    HEALTH_URL="${HEALTH_URL}/api/health"
elif [ "$DEPLOYMENT_TYPE" == "docker" ]; then
    HEALTH_URL="http://localhost:3000/api/health"
elif [ "$DEPLOYMENT_TYPE" == "vps" ]; then
    SERVER_HOST=$(echo "$DEPLOY_SERVER" | cut -d@ -f2)
    HEALTH_URL="http://${SERVER_HOST}/api/health"
fi

# Health check
echo "  → Running health check: ${HEALTH_URL}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}    ✓ Health check passed${NC}"
else
    echo -e "${RED}    ✗ Health check failed (status: ${HTTP_STATUS})${NC}"
    echo ""
    echo "The rollback completed but the application is not responding correctly."
    echo "Please check the logs and investigate further."
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Post-rollback verification passed${NC}"
echo ""

###############################################################################
# ROLLBACK SUMMARY
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Rollback Summary                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "  Deployment type: ${DEPLOYMENT_TYPE}"
echo "  Rollback target: ${ROLLBACK_TARGET}"
echo "  Status: ${GREEN}SUCCESS${NC}"
echo ""
echo -e "${GREEN}✓ Rollback completed successfully${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify critical user flows are working"
echo "  2. Monitor error logs for any issues"
echo "  3. Investigate what caused the need for rollback"
echo "  4. Fix the issue before attempting another deployment"
echo ""

# Send notification (optional)
if [ -n "${SLACK_WEBHOOK_URL}" ]; then
    curl -X POST "${SLACK_WEBHOOK_URL}" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"🔄 TSF ERP Rollback completed: ${DEPLOYMENT_TYPE} to ${ROLLBACK_TARGET}\"}" \
        > /dev/null 2>&1
fi

echo -e "${BLUE}═══════════════════════════════════════${NC}"
