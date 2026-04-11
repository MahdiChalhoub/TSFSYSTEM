#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# TSF BUILD — Rebuild Docker containers from scratch
# ═══════════════════════════════════════════════════════════════
# Usage: ./dev-build.sh           (rebuild all)
#        ./dev-build.sh frontend  (rebuild only frontend)
#        ./dev-build.sh backend   (rebuild only backend)
#        ./dev-build.sh clean     (nuke everything + rebuild)
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
echo "  ║   TSFSYSTEM — Docker Rebuild            ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

TARGET="${1:-}"

if [ "$TARGET" = "clean" ]; then
    echo -e "${RED}${BOLD}▸ FULL CLEAN — removing all containers, images, and cache...${NC}"
    $COMPOSE down --rmi local --remove-orphans 2>/dev/null || true
    docker builder prune -f 2>/dev/null || true
    echo -e "${GREEN}▸ Rebuilding everything from scratch...${NC}"
    $COMPOSE up --build -d
elif [ -n "$TARGET" ]; then
    echo -e "${YELLOW}▸ Rebuilding ${TARGET}...${NC}"
    $COMPOSE up --build -d --no-deps "$TARGET"
else
    echo -e "${GREEN}▸ Rebuilding all services...${NC}"
    $COMPOSE up --build -d
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Build complete!${NC}"
echo ""
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo -e "${YELLOW}  The containers are running with the fresh build.${NC}"
echo -e "${YELLOW}  Hot reload is active for source code changes.${NC}"
echo ""
