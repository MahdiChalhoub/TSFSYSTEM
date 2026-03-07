#!/bin/bash

###############################################################################
# TSF ERP - Local Server Deployment
# Deploy/Update frontend on THIS server
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  TSF ERP - Local Frontend Deployment  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

echo "Project: $PROJECT_ROOT"
echo "Port: $FRONTEND_PORT"
echo ""

# Step 1: Verify we're in the right place
echo -e "${YELLOW}[1/5]${NC} Verifying project..."

cd "$PROJECT_ROOT"

if [ ! -f "package.json" ]; then
    echo -e "${RED}✗ package.json not found${NC}"
    exit 1
fi

if [ ! -d ".next" ]; then
    echo -e "${RED}✗ No build found. Run 'npm run build' first${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Project verified${NC}"
echo ""

# Step 2: Create backup
echo -e "${YELLOW}[2/5]${NC} Creating backup..."

BACKUP_NAME="backup-$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${PROJECT_ROOT}/../tsf-frontend-${BACKUP_NAME}"

echo "  → Backing up .next to ${BACKUP_DIR}"
cp -r "$PROJECT_ROOT/.next" "$BACKUP_DIR/.next" 2>/dev/null || true

echo -e "${GREEN}✓ Backup created${NC}"
echo ""

# Step 3: Check if PM2 is running the app
echo -e "${YELLOW}[3/5]${NC} Checking current process..."

if command -v pm2 &> /dev/null; then
    echo "  → PM2 is installed"

    if pm2 describe tsf-frontend > /dev/null 2>&1; then
        echo "  → Found running PM2 process: tsf-frontend"
        RESTART_METHOD="pm2"
    else
        echo "  → No PM2 process named 'tsf-frontend' found"
        RESTART_METHOD="manual"
    fi
else
    echo "  → PM2 not installed"
    RESTART_METHOD="manual"
fi

echo ""

# Step 4: Install/update dependencies (optional, usually not needed for frontend update)
echo -e "${YELLOW}[4/5]${NC} Checking dependencies..."

# Only install if package-lock.json changed
if [ -f ".deploy-package-lock.md5" ]; then
    OLD_MD5=$(cat .deploy-package-lock.md5)
    NEW_MD5=$(md5sum package-lock.json | awk '{print $1}')

    if [ "$OLD_MD5" != "$NEW_MD5" ]; then
        echo "  → Dependencies changed, reinstalling..."
        npm ci --production
        echo "$NEW_MD5" > .deploy-package-lock.md5
    else
        echo "  → Dependencies unchanged, skipping install"
    fi
else
    echo "  → First deployment, installing dependencies..."
    npm ci --production
    md5sum package-lock.json | awk '{print $1}' > .deploy-package-lock.md5
fi

echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Step 5: Restart application
echo -e "${YELLOW}[5/5]${NC} Restarting application..."

if [ "$RESTART_METHOD" == "pm2" ]; then
    echo "  → Reloading with PM2 (zero-downtime)..."
    pm2 reload tsf-frontend --update-env

    echo ""
    echo "  → PM2 Status:"
    pm2 list | grep tsf-frontend

    echo ""
    echo "  → Recent logs:"
    pm2 logs tsf-frontend --lines 10 --nostream

elif [ "$RESTART_METHOD" == "manual" ]; then
    echo "  → No PM2 process found"
    echo ""
    echo "  To start the frontend, run ONE of these:"
    echo ""
    echo "  1. Production with PM2 (recommended):"
    echo "     pm2 start npm --name tsf-frontend -- start"
    echo "     pm2 save"
    echo ""
    echo "  2. Simple background process:"
    echo "     nohup npm start > frontend.log 2>&1 &"
    echo ""
    echo "  3. Development mode:"
    echo "     npm run dev"
    echo ""
fi

echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

# Verify
echo -e "${YELLOW}Verifying deployment...${NC}"
echo ""

sleep 3

# Check if port is listening
if netstat -tuln 2>/dev/null | grep -q ":${FRONTEND_PORT} "; then
    echo -e "${GREEN}  ✓ Application is listening on port ${FRONTEND_PORT}${NC}"

    # Try health check
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}/api/health" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" == "200" ]; then
        echo -e "${GREEN}  ✓ Health check passed${NC}"
    else
        echo -e "${YELLOW}  ⚠ Health check status: $HTTP_STATUS${NC}"
    fi
elif ss -tuln 2>/dev/null | grep -q ":${FRONTEND_PORT} "; then
    echo -e "${GREEN}  ✓ Application is listening on port ${FRONTEND_PORT}${NC}"
else
    echo -e "${YELLOW}  ⚠ Port ${FRONTEND_PORT} not in use - app may not be running${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Deployment Summary               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "  Project: $PROJECT_ROOT"
echo "  Port: $FRONTEND_PORT"
echo "  Backup: $BACKUP_DIR"
echo "  Method: $RESTART_METHOD"
echo ""

if [ "$RESTART_METHOD" == "pm2" ]; then
    echo "Useful commands:"
    echo "  View logs:     pm2 logs tsf-frontend"
    echo "  Restart:       pm2 restart tsf-frontend"
    echo "  Stop:          pm2 stop tsf-frontend"
    echo "  Status:        pm2 status"
    echo "  Monitor:       pm2 monit"
fi

echo ""
echo "Access your app:"
echo "  Local:         http://localhost:${FRONTEND_PORT}"
echo "  Public:        http://saas.tsf.ci (if Nginx configured)"
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
