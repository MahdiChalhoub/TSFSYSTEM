#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TSFSYSTEM CI Hygiene Check
# Run in CI to enforce repo structure rules.
# Usage: bash scripts/ci/check-repo-hygiene.sh
# ═══════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "═══ TSFSYSTEM Repo Hygiene Check ═══"
echo ""

# ── 1. Root file count ────────────────────────────────────────
ROOT_FILES=$(find . -maxdepth 1 -type f | wc -l)
ROOT_LIMIT=25
echo -n "Root file count: $ROOT_FILES "
if [ "$ROOT_FILES" -gt "$ROOT_LIMIT" ]; then
    echo -e "${RED}FAIL (limit: $ROOT_LIMIT)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# ── 2. Backend root file count ────────────────────────────────
BACKEND_FILES=$(find erp_backend -maxdepth 1 -type f | wc -l)
BACKEND_LIMIT=15
echo -n "Backend root file count: $BACKEND_FILES "
if [ "$BACKEND_FILES" -gt "$BACKEND_LIMIT" ]; then
    echo -e "${RED}FAIL (limit: $BACKEND_LIMIT)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# ── 3. No tracked .env files ─────────────────────────────────
ENV_FILES=$(git ls-files | grep -E '\.env$|\.env\.' | grep -v '\.example' || true)
echo -n "Tracked .env files: "
if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}FAIL${NC}"
    echo "$ENV_FILES" | sed 's/^/  /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}none${NC}"
fi

# ── 4. No tracked .sqlite3 ───────────────────────────────────
SQLITE_FILES=$(git ls-files | grep -E '\.sqlite3?$' || true)
echo -n "Tracked SQLite files: "
if [ -n "$SQLITE_FILES" ]; then
    echo -e "${RED}FAIL${NC}"
    echo "$SQLITE_FILES" | sed 's/^/  /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}none${NC}"
fi

# ── 5. No tracked SQL dumps ──────────────────────────────────
SQL_FILES=$(git ls-files | grep -E '\.sql$' || true)
echo -n "Tracked SQL dumps: "
if [ -n "$SQL_FILES" ]; then
    echo -e "${RED}FAIL${NC}"
    echo "$SQL_FILES" | sed 's/^/  /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}none${NC}"
fi

# ── 6. No forbidden directories tracked ──────────────────────
FORBIDDEN_DIRS=("ARCHIVE" "restored" "_inventory_mode_src" ".backups" "erp_backend/media" "erp_backend/staticfiles" "dist" "erp_backend/dist")
for dir in "${FORBIDDEN_DIRS[@]}"; do
    TRACKED=$(git ls-files | grep "^$dir/" | head -1 || true)
    echo -n "Forbidden dir '$dir/': "
    if [ -n "$TRACKED" ]; then
        echo -e "${YELLOW}WARN (still in history)${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}clean${NC}"
    fi
done

# ── 7. No files > 10MB ───────────────────────────────────────
echo -n "Files > 10MB: "
LARGE_FILES=$(git ls-files | xargs -I{} sh -c 'if [ -f "{}" ]; then size=$(stat -c%s "{}" 2>/dev/null || echo 0); if [ "$size" -gt 10485760 ]; then echo "{}"; fi; fi' 2>/dev/null || true)
if [ -n "$LARGE_FILES" ]; then
    echo -e "${RED}FAIL${NC}"
    echo "$LARGE_FILES" | sed 's/^/  /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}none${NC}"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}FAILED: $ERRORS error(s), $WARNINGS warning(s)${NC}"
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}PASSED with $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${GREEN}PASSED: All hygiene checks OK${NC}"
    exit 0
fi
