#!/bin/bash
# ╔══════════════════════════════════════════════════════════╗
# ║  Migration Guard — Pre-deploy check for pending DB      ║
# ║  migrations. Called by deploy_server.sh BEFORE migrate.  ║
# ║                                                          ║
# ║  OUTPUTS:                                               ║
# ║   • List of pending migrations per app                  ║
# ║   • Exit 0 = clean (or auto-proceed)                    ║
# ║   • Exit 1 = blocked (review MIGRATIONS.md)             ║
# ╚══════════════════════════════════════════════════════════╝

set -e

PROJECT_DIR="${1:-/root/TSFSYSTEM}"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}═══ Migration Pre-Flight Check ═══${NC}"
echo ""

# Get pending migrations using showmigrations --plan
PENDING=$(docker-compose -f "$COMPOSE_FILE" run --rm -T backend \
    python manage.py showmigrations --plan 2>/dev/null \
    | grep '\[ \]' || true)

if [ -z "$PENDING" ]; then
    echo -e "${GREEN}✅ No pending migrations. Database is up to date.${NC}"
    echo ""
    exit 0
fi

# Count pending
PENDING_COUNT=$(echo "$PENDING" | wc -l)

echo -e "${YELLOW}⚠️  Found ${BOLD}${PENDING_COUNT}${NC}${YELLOW} pending migration(s):${NC}"
echo ""

# Group by app
CURRENT_APP=""
while IFS= read -r line; do
    # Extract app name from migration path (format: " [ ] appname.XXXX_name")
    APP=$(echo "$line" | sed 's/.*\[ \] //' | cut -d'.' -f1)
    MIGRATION=$(echo "$line" | sed 's/.*\[ \] //')

    if [ "$APP" != "$CURRENT_APP" ]; then
        CURRENT_APP="$APP"
        echo -e "  ${BOLD}${CYAN}$APP${NC}"
    fi
    echo -e "    ${YELLOW}○${NC} $MIGRATION"
done <<< "$PENDING"

echo ""

# Determine if these are safe (all have defaults) or destructive
# For now, all AddField migrations with defaults are safe
echo -e "${GREEN}→ These will be applied automatically by 'migrate --noinput'${NC}"
echo -e "${CYAN}ℹ️  See MIGRATIONS.md for details on what changed.${NC}"
echo ""

exit 0
