#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# TSF DEV — Start Docker dev environment with hot reload
# ═══════════════════════════════════════════════════════════════
# Usage: ./dev.sh
#        ./dev.sh logs      (start + follow logs)
#        ./dev.sh frontend  (start only frontend)
#        ./dev.sh backend   (start only backend)
# ═══════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

COMPOSE="docker compose -f docker-compose.dev.yml"

echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   TSFSYSTEM — Docker Dev Environment    ║"
echo "  ║          Hot Reload Enabled 🔥           ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Kill any old non-docker processes on our ports
echo -e "${YELLOW}▸ Stopping old processes (PM2, systemd)...${NC}"
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
systemctl stop tsfsystem-frontend.service 2>/dev/null || true
systemctl stop tsfsystem.service 2>/dev/null || true
pkill -9 -f "next start" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
sleep 1

# Ensure PostgreSQL is running on host
if ! pg_isready -q 2>/dev/null; then
    echo -e "${YELLOW}▸ Starting PostgreSQL...${NC}"
    systemctl start postgresql
fi

# Ensure Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${YELLOW}▸ Starting Docker daemon...${NC}"
    systemctl start docker
    sleep 2
fi

# Start containers
SERVICE="${1:-}"

if [ "$SERVICE" = "logs" ]; then
    echo -e "${GREEN}▸ Starting all services...${NC}"
    $COMPOSE up -d
    echo ""
    echo -e "${GREEN}${BOLD}✓ All services running — following logs (Ctrl+C to stop logs, containers keep running)${NC}"
    echo ""
    $COMPOSE logs -f
elif [ -n "$SERVICE" ] && [ "$SERVICE" != "logs" ]; then
    echo -e "${GREEN}▸ Starting ${SERVICE}...${NC}"
    $COMPOSE up -d "$SERVICE"
else
    echo -e "${GREEN}▸ Starting all services...${NC}"
    $COMPOSE up -d
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Dev environment is running!${NC}"
echo ""
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo -e "${CYAN}  Frontend:  http://localhost:3000${NC}"
echo -e "${CYAN}  Backend:   http://localhost:8000${NC}"
echo ""
echo -e "${YELLOW}  Hot reload is active — save any file and it auto-compiles.${NC}"
echo -e "${YELLOW}  Logs: ./dev.sh logs  |  Restart: ./dev-restart.sh  |  Rebuild: ./dev-build.sh${NC}"
echo ""
