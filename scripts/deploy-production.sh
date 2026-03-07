#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# deploy-production.sh — Quick deployment script for production server
#
# Run this ON THE PRODUCTION SERVER (91.99.186.183)
#
# Usage:
#   bash deploy-production.sh
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"; }
ok() { echo -e "${GREEN}✅ $*${NC}"; }
err() { echo -e "${RED}❌ $*${NC}"; exit 1; }

echo ""
echo "════════════════════════════════════════════════════════"
echo "  🚀 TSF Platform Production Deployment"
echo "════════════════════════════════════════════════════════"
echo ""

# Verify we're on production server
CURRENT_IP=$(curl -s ifconfig.me || echo "unknown")
log "Current server IP: $CURRENT_IP"

if [[ "$CURRENT_IP" != "91.99.186.183" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  WARNING: This doesn't look like the production server!${NC}"
    echo -e "Expected: 91.99.186.183"
    echo -e "Current:  $CURRENT_IP"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        err "Deployment cancelled"
    fi
fi

# Change to project directory
PROJECT_DIR="${PROJECT_DIR:-/root/TSFSYSTEM}"
if [[ ! -d "$PROJECT_DIR" ]]; then
    err "Project directory not found: $PROJECT_DIR"
fi

log "Changing to $PROJECT_DIR"
cd "$PROJECT_DIR"

# Pull latest code
log "📥 Pulling latest code from origin/main..."
git fetch origin main
git reset --hard origin/main
ok "Code updated"

# Remove duplicate MCP directory if exists
if [[ -d "src/app/(privileged)/mcp" ]]; then
    log "🧹 Removing duplicate MCP directory..."
    rm -rf "src/app/(privileged)/mcp"
    ok "Duplicate MCP directory removed"
fi

# Install frontend dependencies
log "📦 Installing frontend dependencies..."
if npm install --no-audit --no-fund; then
    ok "Dependencies installed"
else
    err "Failed to install dependencies"
fi

# Build frontend
log "🔨 Building frontend (this takes 30-60 seconds)..."
echo ""
if npm run build; then
    ok "Frontend built successfully"
else
    err "Frontend build failed! Check error above."
fi

# Check if build succeeded
if [[ ! -f ".next/BUILD_ID" ]]; then
    err "Build failed - no BUILD_ID found"
fi

BUILD_ID=$(cat .next/BUILD_ID)
log "Build ID: $BUILD_ID"

# Restart services
log "♻️  Restarting services..."

if systemctl restart tsfsystem-frontend.service; then
    ok "Frontend service restarted"
else
    err "Failed to restart frontend service"
fi

# Optional: restart backend if needed
if systemctl is-active --quiet tsfsystem.service; then
    log "Backend service is running (not restarting)"
else
    log "Starting backend service..."
    systemctl start tsfsystem.service || true
fi

# Reload Nginx
if systemctl reload nginx; then
    ok "Nginx reloaded"
else
    err "Failed to reload Nginx"
fi

# Wait for services to stabilize
log "⏳ Waiting for services to stabilize..."
sleep 3

# Verify services
log "🔍 Verifying services..."

if systemctl is-active --quiet tsfsystem-frontend.service; then
    ok "Frontend service: Active"
else
    err "Frontend service: FAILED"
fi

if systemctl is-active --quiet tsfsystem.service; then
    ok "Backend service: Active"
else
    echo -e "${YELLOW}⚠️  Backend service: Not running (may be normal if using Docker)${NC}"
fi

if systemctl is-active --quiet nginx; then
    ok "Nginx: Active"
else
    err "Nginx: FAILED"
fi

# Test local access
log "🧪 Testing local access..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q "200"; then
    ok "Frontend responding on port 3000"
else
    err "Frontend not responding on port 3000"
fi

# Display service status
echo ""
log "📊 Service Status:"
systemctl status tsfsystem-frontend.service --no-pager -l | head -10

echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}  ✅ DEPLOYMENT COMPLETE${NC}"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📝 Next Steps:"
echo "  1. Wait 30-60 seconds for services to fully start"
echo "  2. Visit: https://tsf.ci"
echo "  3. If still not working, check Cloudflare:"
echo "     - SSL/TLS mode: Full (strict)"
echo "     - Purge cache"
echo ""
echo "📋 Verification Commands:"
echo "  curl -I http://localhost:3000/"
echo "  journalctl -u tsfsystem-frontend.service -n 50"
echo "  tail -f /var/log/tsfsystem-frontend.log"
echo ""
