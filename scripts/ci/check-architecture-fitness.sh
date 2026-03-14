#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TSFSYSTEM Architecture Fitness Tests
# ═══════════════════════════════════════════════════════════════
# Run: bash scripts/ci/check-architecture-fitness.sh
# Purpose: Enforce module boundaries, prevent forbidden imports,
#          validate structural rules that unit tests don't cover.
# ═══════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "═══ TSFSYSTEM Architecture Fitness Tests ═══"
echo ""

# ── 1. No direct cross-module imports in backend ──────────────
# Modules may NOT import directly from other app modules.
# All cross-module communication must go through ConnectorEngine.
echo -n "1. Cross-module imports: "
VIOLATIONS=""

# Check if POS imports from finance directly
POS_FINANCE=$(grep -rn "from apps\.finance" erp_backend/apps/pos/ --include="*.py" 2>/dev/null | grep -v "__pycache__" | grep -v "migrations/" | grep -v "^.*#" | grep -v "NO LONGER" | grep -v "Refactored" || true)
if [ -n "$POS_FINANCE" ]; then
    VIOLATIONS="$VIOLATIONS\n  POS → Finance:\n$(echo "$POS_FINANCE" | head -3 | sed 's/^/    /')"
fi

# Check if inventory imports from finance directly
INV_FINANCE=$(grep -rn "from apps\.finance" erp_backend/apps/inventory/ --include="*.py" 2>/dev/null | grep -v "__pycache__" | grep -v "migrations/" | grep -v "^.*#" | grep -v "NO LONGER" | grep -v "Refactored" || true)
if [ -n "$INV_FINANCE" ]; then
    VIOLATIONS="$VIOLATIONS\n  Inventory → Finance:\n$(echo "$INV_FINANCE" | head -3 | sed 's/^/    /')"
fi

# Check if CRM imports from finance
CRM_FINANCE=$(grep -rn "from apps\.finance" erp_backend/apps/crm/ --include="*.py" 2>/dev/null | grep -v "__pycache__" | grep -v "migrations/" | grep -v "^.*#" | grep -v "NO LONGER" | grep -v "Refactored" || true)
if [ -n "$CRM_FINANCE" ]; then
    VIOLATIONS="$VIOLATIONS\n  CRM → Finance:\n$(echo "$CRM_FINANCE" | head -3 | sed 's/^/    /')"
fi

# Check if HR imports from finance
HR_FINANCE=$(grep -rn "from apps\.finance" erp_backend/apps/hr/ --include="*.py" 2>/dev/null | grep -v "__pycache__" | grep -v "migrations/" | grep -v "^.*#" | grep -v "NO LONGER" | grep -v "Refactored" || true)
if [ -n "$HR_FINANCE" ]; then
    VIOLATIONS="$VIOLATIONS\n  HR → Finance:\n$(echo "$HR_FINANCE" | head -3 | sed 's/^/    /')"
fi

if [ -n "$VIOLATIONS" ]; then
    echo -e "${RED}FAIL${NC}"
    echo -e "$VIOLATIONS"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}OK — no forbidden cross-module imports${NC}"
fi

# ── 2. No hardcoded COA codes in production code ──────────────
echo -n "2. Hardcoded COA codes: "
# Look for patterns like account_code="400" or account="411000" in non-test, non-migration files
HARDCODED_COA=$(grep -rn "account_code\s*=\s*['\"]" erp_backend/apps/ --include="*.py" 2>/dev/null \
    | grep -v "__pycache__" | grep -v "migrations/" | grep -v "test_" | grep -v "seed" \
    | grep -v "posting_rules" | grep -v "# legacy" \
    | grep -v "= ''" | grep -v '= ""' || true)
if [ -n "$HARDCODED_COA" ]; then
    echo -e "${YELLOW}WARN ($(echo "$HARDCODED_COA" | wc -l) instances)${NC}"
    echo "$HARDCODED_COA" | head -5 | sed 's/^/  /'
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}OK — COA resolved from posting rules${NC}"
fi

# ── 3. Frontend: no direct API calls outside erpFetch ─────────
echo -n "3. Frontend API discipline: "
# Only check client-side pages/components, not server actions or portals
RAW_FETCH=$(grep -rn "fetch(" src/app/ --include="*.tsx" 2>/dev/null \
    | grep -v "erpFetch" | grep -v "node_modules" | grep -v ".next" \
    | grep -v "/actions/" | grep -v "supplier-portal" | grep -v "api/proxy" \
    | grep -v "/tenant/" | grep -v "/delivery/" \
    | grep -v "// allowed" | grep -v "revalidate" | grep -v "next/cache" \
    | grep -v "'use server'" || true)
if [ -n "$RAW_FETCH" ]; then
    COUNT=$(echo "$RAW_FETCH" | wc -l)
    echo -e "${YELLOW}WARN ($COUNT raw fetch calls in client pages)${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}OK — client pages use erpFetch${NC}"
fi

# ── 4. No posting logic outside finance module ────────────────
echo -n "4. Posting discipline: "
# Note: LedgerService obtained via connector.require() is architecturally correct.
# We only flag direct imports like 'from apps.finance import LedgerService'
POSTING_OUTSIDE=$(grep -rn "from apps\.finance.*import.*LedgerService\|from apps\.finance.*import.*JournalEntry" \
    erp_backend/apps/ --include="*.py" 2>/dev/null \
    | grep -v "erp_backend/apps/finance/" \
    | grep -v "erp_backend/apps/migration/" \
    | grep -v "__pycache__" | grep -v "migrations/" \
    | grep -v "^.*#" | grep -v "NO LONGER" || true)
if [ -n "$POSTING_OUTSIDE" ]; then
    echo -e "${YELLOW}WARN (posting references outside finance)${NC}"
    echo "$POSTING_OUTSIDE" | head -3 | sed 's/^/  /'
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}OK — posting logic contained in finance${NC}"
fi

# ── 5. ConnectorEngine used for cross-module routing ──────────
echo -n "5. ConnectorEngine usage: "
CONNECTOR_USAGE=$(grep -rn "ConnectorEngine" erp_backend/apps/ --include="*.py" 2>/dev/null \
    | grep -v "__pycache__" | wc -l)
if [ "$CONNECTOR_USAGE" -gt 0 ]; then
    echo -e "${GREEN}OK ($CONNECTOR_USAGE references)${NC}"
else
    echo -e "${YELLOW}WARN — no ConnectorEngine usage found in apps${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# ── 6. No .env values in source code ─────────────────────────
echo -n "6. Secrets in source: "
SECRETS=$(grep -rn "POSTGRES_PASSWORD\|SECRET_KEY\|DATABASE_URL\|AWS_SECRET" \
    erp_backend/apps/ erp_backend/core/ erp_backend/erp/ src/ --include="*.py" --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -v "__pycache__" | grep -v "node_modules" | grep -v ".next" | grep -v ".venv" \
    | grep -v "os.environ\|os.getenv\|process.env\|settings\.\|\.env" \
    | grep -v "example\|template\|README" \
    | grep -v "secret_key\|SECRET_KEY" || true)
if [ -n "$SECRETS" ]; then
    echo -e "${RED}FAIL — possible hardcoded secrets${NC}"
    echo "$SECRETS" | head -3 | sed 's/^/  /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}OK — no hardcoded secrets detected${NC}"
fi

# ── 7. Root file count regression check ───────────────────────
echo -n "7. Root file count: "
ROOT_TRACKED=$(git ls-files | grep -cv '/' 2>/dev/null || echo 99)
if [ "$ROOT_TRACKED" -gt 20 ]; then
    echo -e "${RED}FAIL ($ROOT_TRACKED tracked, limit: 20)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}OK ($ROOT_TRACKED)${NC}"
fi

# ── 8. Backend root file count ────────────────────────────────
echo -n "8. Backend root files: "
BACKEND_TRACKED=$(git ls-files | grep '^erp_backend/[^/]*$' | wc -l)
if [ "$BACKEND_TRACKED" -gt 15 ]; then
    echo -e "${RED}FAIL ($BACKEND_TRACKED tracked, limit: 15)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}OK ($BACKEND_TRACKED)${NC}"
fi

# ── 9. No duplicate doc roots ─────────────────────────────────
echo -n "9. Doc root consolidation: "
EXTRA_DOCS=""
git ls-files | grep -q '^tsf-docs/' && EXTRA_DOCS="tsf-docs "
git ls-files | grep -q '^DOCUMENTATION/' && EXTRA_DOCS="${EXTRA_DOCS}DOCUMENTATION "
if [ -n "$EXTRA_DOCS" ]; then
    echo -e "${RED}FAIL — extra doc roots: $EXTRA_DOCS${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}OK — docs/ is canonical${NC}"
fi

# ── 10. No forbidden patterns in tracked files ───────────────
echo -n "10. Forbidden tracked files: "
FORBIDDEN=$(git ls-files | grep -E '\.(sql|sqlite3)$' | head -3)
if [ -n "$FORBIDDEN" ]; then
    echo -e "${RED}FAIL — forbidden files tracked: $FORBIDDEN${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}OK — no forbidden files tracked${NC}"
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
    echo -e "${GREEN}PASSED: All architecture fitness tests OK${NC}"
    exit 0
fi
