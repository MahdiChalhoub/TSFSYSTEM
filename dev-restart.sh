#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# TSF RESTART — Restart Docker containers (no rebuild)
# ═══════════════════════════════════════════════════════════════
# Usage: ./dev-restart.sh           (restart all)
#        ./dev-restart.sh frontend  (restart only frontend)
#        ./dev-restart.sh backend   (restart only backend)
#        ./dev-restart.sh stop      (stop everything)
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

TARGET="${1:-}"

if [ "$TARGET" = "stop" ]; then
    echo -e "${RED}${BOLD}▸ Stopping all services...${NC}"
    $COMPOSE down
    echo -e "${GREEN}✓ All containers stopped.${NC}"
    exit 0
fi

if [ "$TARGET" = "status" ]; then
    echo -e "${CYAN}${BOLD}"
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║   TSFSYSTEM — Container Status          ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo -e "${NC}"
    $COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo -e "${YELLOW}  Memory usage:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $(docker compose -f docker-compose.dev.yml ps -q) 2>/dev/null || true
    exit 0
fi

if [ "$TARGET" = "logs" ]; then
    $COMPOSE logs -f --tail 50
    exit 0
fi

if [ -n "$TARGET" ]; then
    echo -e "${YELLOW}▸ Restarting ${TARGET}...${NC}"
    $COMPOSE restart "$TARGET"
else
    echo -e "${YELLOW}▸ Restarting all services...${NC}"
    $COMPOSE restart
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Restart complete!${NC}"
echo ""
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
