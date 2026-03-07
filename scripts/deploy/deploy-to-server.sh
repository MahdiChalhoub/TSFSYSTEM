#!/bin/bash

###############################################################################
# TSF ERP - Deploy Frontend to Your Server
# Simple script to update the frontend on your production server
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  TSF ERP - Deploy Frontend to Server  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Configuration (you can modify these)
SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="${SERVER_HOST:-saas.tsf.ci}"
SERVER_PATH="${SERVER_PATH:-/var/www/tsf-frontend}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "Configuration:"
echo "  Server: ${SERVER_USER}@${SERVER_HOST}"
echo "  Path: ${SERVER_PATH}"
echo "  Port: ${FRONTEND_PORT}"
echo ""

# Step 1: Check if build exists
echo -e "${YELLOW}[1/6]${NC} Checking local build..."

cd "$PROJECT_ROOT"

if [ ! -d ".next" ]; then
    echo -e "${RED}✗ No build found. Run 'npm run build' first${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build found${NC}"
echo ""

# Step 2: Test SSH connection
echo -e "${YELLOW}[2/6]${NC} Testing server connection..."

if ssh -o BatchMode=yes -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_HOST}" echo "OK" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server connection successful${NC}"
else
    echo -e "${RED}✗ Cannot connect to server${NC}"
    echo "Make sure you can SSH to: ${SERVER_USER}@${SERVER_HOST}"
    exit 1
fi

echo ""

# Step 3: Create backup on server
echo -e "${YELLOW}[3/6]${NC} Creating backup on server..."

BACKUP_NAME="backup-$(date +%Y%m%d_%H%M%S)"

ssh "${SERVER_USER}@${SERVER_HOST}" << EOF
    if [ -d "${SERVER_PATH}" ]; then
        echo "  → Backing up to ${SERVER_PATH}-${BACKUP_NAME}"
        cp -r "${SERVER_PATH}" "${SERVER_PATH}-${BACKUP_NAME}"
        echo "  ✓ Backup created"
    else
        echo "  → No existing deployment, creating directory"
        mkdir -p "${SERVER_PATH}"
    fi
EOF

echo -e "${GREEN}✓ Backup complete${NC}"
echo ""

# Step 4: Upload files to server
echo -e "${YELLOW}[4/6]${NC} Uploading files to server..."

echo "  → Syncing files (this may take a few minutes)..."

# Sync files using rsync (faster than scp)
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next/cache' \
    --exclude 'erp_backend' \
    "$PROJECT_ROOT/" \
    "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"

echo -e "${GREEN}✓ Files uploaded${NC}"
echo ""

# Step 5: Install and build on server
echo -e "${YELLOW}[5/6]${NC} Installing and building on server..."

ssh "${SERVER_USER}@${SERVER_HOST}" << EOF
    set -e
    cd "${SERVER_PATH}"

    echo "  → Installing dependencies..."
    npm ci --production

    echo "  → Building application..."
    npm run build

    echo "  ✓ Build complete"
EOF

echo -e "${GREEN}✓ Installation and build complete${NC}"
echo ""

# Step 6: Restart application
echo -e "${YELLOW}[6/6]${NC} Restarting application..."

ssh "${SERVER_USER}@${SERVER_HOST}" << EOF
    set -e
    cd "${SERVER_PATH}"

    # Check if PM2 is installed
    if command -v pm2 &> /dev/null; then
        echo "  → Using PM2 to restart..."

        # Check if process exists
        if pm2 describe tsf-frontend > /dev/null 2>&1; then
            echo "  → Reloading existing process..."
            pm2 reload tsf-frontend --update-env
        else
            echo "  → Starting new PM2 process..."
            pm2 start npm --name "tsf-frontend" -- start
            pm2 save
        fi

        echo "  → PM2 Status:"
        pm2 list | grep tsf-frontend || echo "    Process started"

    else
        echo "  ⚠ PM2 not found, starting with npm..."
        echo "  Note: For production, install PM2: npm install -g pm2"

        # Kill any existing npm process on port ${FRONTEND_PORT}
        pkill -f "next start" || true

        # Start in background
        nohup npm start > "${SERVER_PATH}/frontend.log" 2>&1 &
        echo "  ✓ Started (check logs: tail -f ${SERVER_PATH}/frontend.log)"
    fi
EOF

echo -e "${GREEN}✓ Application restarted${NC}"
echo ""

# Step 7: Verify deployment
echo -e "${YELLOW}Verifying deployment...${NC}"
echo ""

sleep 5

echo "  → Testing health endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_HOST}:${FRONTEND_PORT}/api/health" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}    ✓ Health check passed${NC}"
elif [ "$HTTP_STATUS" == "000" ]; then
    echo -e "${YELLOW}    ⚠ Cannot reach port ${FRONTEND_PORT} - check if Nginx is configured${NC}"
else
    echo -e "${YELLOW}    ⚠ Health check returned status: $HTTP_STATUS${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Deployment Complete!             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "  Server: ${SERVER_USER}@${SERVER_HOST}"
echo "  Path: ${SERVER_PATH}"
echo "  Port: ${FRONTEND_PORT}"
echo "  Backup: ${BACKUP_NAME}"
echo ""
echo -e "${GREEN}✓ Frontend deployed successfully!${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:     ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 logs tsf-frontend'"
echo "  Restart:       ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 restart tsf-frontend'"
echo "  Check status:  ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 status'"
echo "  Rollback:      ssh ${SERVER_USER}@${SERVER_HOST} 'rm -rf ${SERVER_PATH} && mv ${SERVER_PATH}-${BACKUP_NAME} ${SERVER_PATH} && pm2 restart tsf-frontend'"
echo ""
echo "Next steps:"
echo "  1. Configure Nginx to proxy to port ${FRONTEND_PORT}"
echo "  2. Test your application at: http://${SERVER_HOST}"
echo "  3. Monitor logs for any errors"
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
