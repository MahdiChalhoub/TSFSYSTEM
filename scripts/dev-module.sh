#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# dev-module.sh — Start Next.js dev server focused on a single module
#
# Usage:
#   bash scripts/dev-module.sh <module_name>
#   bash scripts/dev-module.sh inventory
#   bash scripts/dev-module.sh finance
#
# What it does:
#   1. Validates the module exists in src/modules/
#   2. Sets DEV_MODULE=<name> environment variable
#   3. Starts next dev on port 3001 (so it doesn't touch production on 3000)
#   4. The middleware blocks routes for other modules
#
# The live server at tsf.ci is NEVER touched by this script.
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODULES_DIR="$PROJECT_ROOT/src/modules"
DEV_PORT="${DEV_PORT:-3001}"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Discover available modules ────────────────────────────────────────────────
discover_modules() {
    local modules=()
    for dir in "$MODULES_DIR"/*/; do
        if [[ -f "$dir/manifest.json" ]]; then
            modules+=("$(basename "$dir")")
        fi
    done
    echo "${modules[@]}"
}

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
    echo ""
    echo -e "${BOLD}🔧 TSF Module Dev Server${NC}"
    echo ""
    echo -e "  Usage: ${CYAN}bash scripts/dev-module.sh <module_name>${NC}"
    echo ""
    echo -e "  ${BOLD}Available modules:${NC}"
    
    local modules
    modules=$(discover_modules)
    for mod in $modules; do
        local name
        name=$(grep -o '"name": *"[^"]*"' "$MODULES_DIR/$mod/manifest.json" 2>/dev/null | head -1 | sed 's/"name": *"//;s/"$//')
        echo -e "    ${GREEN}•${NC} ${BOLD}$mod${NC} — $name"
    done
    
    echo ""
    echo -e "  ${BOLD}Examples:${NC}"
    echo -e "    bash scripts/dev-module.sh inventory"
    echo -e "    bash scripts/dev-module.sh finance"
    echo -e "    npm run dev:module -- sales"
    echo ""
    echo -e "  ${BOLD}Options:${NC}"
    echo -e "    DEV_PORT=3002 bash scripts/dev-module.sh inventory  ${YELLOW}# custom port${NC}"
    echo ""
    exit 1
}

# ── Validate ──────────────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
    usage
fi

MODULE_NAME="$1"
AVAILABLE_MODULES=$(discover_modules)

# Check if module exists
if [[ ! -d "$MODULES_DIR/$MODULE_NAME" ]] || [[ ! -f "$MODULES_DIR/$MODULE_NAME/manifest.json" ]]; then
    echo ""
    echo -e "${RED}❌ Module '$MODULE_NAME' not found!${NC}"
    echo ""
    echo -e "Available modules: ${CYAN}$AVAILABLE_MODULES${NC}"
    echo ""
    exit 1
fi

# Read module info from manifest
MODULE_DISPLAY_NAME=$(grep -o '"name": *"[^"]*"' "$MODULES_DIR/$MODULE_NAME/manifest.json" 2>/dev/null | head -1 | sed 's/"name": *"//;s/"$//')
MODULE_VERSION=$(grep -o '"version": *"[^"]*"' "$MODULES_DIR/$MODULE_NAME/manifest.json" 2>/dev/null | head -1 | sed 's/"version": *"//;s/"$//')

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🔧 TSF MODULE DEV MODE${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Module:  ${BOLD}$MODULE_DISPLAY_NAME${NC} ($MODULE_NAME v$MODULE_VERSION)"
echo -e "  Port:    ${CYAN}http://localhost:$DEV_PORT${NC}"
echo -e "  Mode:    ${YELLOW}ISOLATED${NC} — other modules are locked"
echo ""
echo -e "  ${GREEN}✓${NC} Core routes (dashboard, settings, auth) always accessible"
echo -e "  ${RED}✗${NC} Other module routes return 'Module Locked' page"
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo ""

# Start Next.js dev server with DEV_MODULE set
cd "$PROJECT_ROOT"
DEV_MODULE="$MODULE_NAME" npx next dev --port "$DEV_PORT"
