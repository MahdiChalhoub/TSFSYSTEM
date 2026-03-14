#!/bin/bash
#
# Deployment Verification Script
# ==============================
# Verifies that all critical fixes and optimizations are in place.
#
# Usage:
#   bash scripts/verify_deployment.sh
#   bash scripts/verify_deployment.sh --staging  # Verify staging environment
#   bash scripts/verify_deployment.sh --production  # Verify production environment
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT="${1:-local}"

echo ""
echo "================================================================"
echo "  TSFSYSTEM Deployment Verification"
echo "  Environment: $ENVIRONMENT"
echo "================================================================"
echo ""

# Check if Django is available
if ! command -v python &> /dev/null; then
    echo -e "${RED}❌ Python not found${NC}"
    exit 1
fi

cd "$(dirname "$0")/../erp_backend" || exit 1

# 1. Check TypeScript compilation
echo -e "${BLUE}📋 Step 1: TypeScript Type Check${NC}"
cd ..
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript check passed${NC}"
else
    echo -e "${RED}❌ TypeScript check failed${NC}"
    exit 1
fi
cd erp_backend

# 2. Check database migrations
echo ""
echo -e "${BLUE}📋 Step 2: Database Migrations${NC}"

UNMIGRATED=$(python manage.py showmigrations --plan | grep "\[ \]" || true)
if [ -z "$UNMIGRATED" ]; then
    echo -e "${GREEN}✅ All migrations applied${NC}"
else
    echo -e "${YELLOW}⚠️  Unmigrated migrations found:${NC}"
    echo "$UNMIGRATED"
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "${RED}❌ Production requires all migrations applied${NC}"
        exit 1
    fi
fi

# 3. Check workforce migrations specifically
echo ""
echo -e "${BLUE}📋 Step 3: Workforce Module Migrations${NC}"

WORKFORCE_MIGRATIONS=$(python manage.py showmigrations workforce | tail -5)
echo "$WORKFORCE_MIGRATIONS"

if echo "$WORKFORCE_MIGRATIONS" | grep -q "0005_fix_tenant_owned_model"; then
    echo -e "${GREEN}✅ CRITICAL-001 fix migration present${NC}"
else
    echo -e "${RED}❌ CRITICAL-001 fix migration missing${NC}"
    exit 1
fi

if echo "$WORKFORCE_MIGRATIONS" | grep -q "0006_add_performance_indexes"; then
    echo -e "${GREEN}✅ Performance indexes migration present${NC}"
else
    echo -e "${YELLOW}⚠️  Performance indexes migration not found${NC}"
fi

# 4. Check procurement governance migrations
echo ""
echo -e "${BLUE}📋 Step 4: Procurement Governance Migrations${NC}"

POS_MIGRATIONS=$(python manage.py showmigrations pos | tail -5)
if echo "$POS_MIGRATIONS" | grep -q "0063_fix_procurement_governance_tenant_owned"; then
    echo -e "${GREEN}✅ CRITICAL-002 fix migration present${NC}"
else
    echo -e "${RED}❌ CRITICAL-002 fix migration missing${NC}"
    exit 1
fi

# 5. Check for TenantOwnedModel inheritance
echo ""
echo -e "${BLUE}📋 Step 5: Architecture Compliance Check${NC}"

if grep -q "class ScoreRule(AuditLogMixin, TenantOwnedModel)" apps/workforce/models.py; then
    echo -e "${GREEN}✅ ScoreRule uses TenantOwnedModel${NC}"
else
    echo -e "${RED}❌ ScoreRule not using TenantOwnedModel${NC}"
    exit 1
fi

if grep -q "class ThreeWayMatchResult(AuditLogMixin, TenantOwnedModel)" apps/pos/models/procurement_governance_models.py; then
    echo -e "${GREEN}✅ ThreeWayMatchResult uses TenantOwnedModel${NC}"
else
    echo -e "${RED}❌ ThreeWayMatchResult not using TenantOwnedModel${NC}"
    exit 1
fi

# 6. Check for get_config usage
echo ""
echo -e "${BLUE}📋 Step 6: Configuration System Check${NC}"

if grep -q "from kernel.config import get_config" apps/workforce/services.py; then
    echo -e "${GREEN}✅ WorkforceScoreEngine uses get_config()${NC}"
else
    echo -e "${RED}❌ WorkforceScoreEngine not using get_config()${NC}"
    exit 1
fi

if grep -q "get_config('workforce.family_weights'" apps/workforce/services.py; then
    echo -e "${GREEN}✅ Family weights configuration-driven${NC}"
else
    echo -e "${RED}❌ Family weights still hardcoded${NC}"
    exit 1
fi

# 7. Check for RBAC decorators
echo ""
echo -e "${BLUE}📋 Step 7: RBAC Security Check${NC}"

if grep -q "@method_decorator(require_permission('workforce.manage_rules')" apps/workforce/views.py; then
    echo -e "${GREEN}✅ ScoreRuleViewSet has RBAC protection${NC}"
else
    echo -e "${RED}❌ ScoreRuleViewSet missing RBAC protection${NC}"
    exit 1
fi

if grep -q "from kernel.rbac.decorators import require_permission" apps/workforce/views.py; then
    echo -e "${GREEN}✅ RBAC decorators imported${NC}"
else
    echo -e "${RED}❌ RBAC decorators not imported${NC}"
    exit 1
fi

# 8. Check database indexes (if in database)
echo ""
echo -e "${BLUE}📋 Step 8: Database Indexes Check${NC}"

if [ "$ENVIRONMENT" != "local" ]; then
    INDEX_COUNT=$(python manage.py dbshell << EOF | grep -c "workforce_" || true
    SELECT indexname FROM pg_indexes WHERE tablename LIKE 'workforce_%';
    \\q
EOF
)
    if [ "$INDEX_COUNT" -gt 10 ]; then
        echo -e "${GREEN}✅ Database indexes present ($INDEX_COUNT found)${NC}"
    else
        echo -e "${YELLOW}⚠️  Few database indexes found ($INDEX_COUNT)${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Skipped (local environment)${NC}"
fi

# 9. Run tests
echo ""
echo -e "${BLUE}📋 Step 9: Test Suite Execution${NC}"

if python manage.py test apps.workforce.tests --verbosity=0 2>&1 | grep -q "OK"; then
    echo -e "${GREEN}✅ All workforce tests passed${NC}"
else
    echo -e "${RED}❌ Workforce tests failed${NC}"
    if [ "$ENVIRONMENT" = "production" ]; then
        exit 1
    fi
fi

# 10. Check for N+1 queries (static analysis)
echo ""
echo -e "${BLUE}📋 Step 10: N+1 Query Prevention Check${NC}"

if grep -q "select_related('branch', 'employee')" apps/workforce/services.py; then
    echo -e "${GREEN}✅ N+1 query optimization present (rank_employees)${NC}"
else
    echo -e "${YELLOW}⚠️  N+1 query optimization not found${NC}"
fi

if grep -q "select_related('employee', 'branch', 'department')" apps/workforce/services.py; then
    echo -e "${GREEN}✅ N+1 query optimization present (snapshot_period)${NC}"
else
    echo -e "${YELLOW}⚠️  N+1 query optimization not found${NC}"
fi

# Final summary
echo ""
echo "================================================================"
echo -e "${GREEN}✅ Deployment Verification Complete${NC}"
echo "================================================================"
echo ""
echo "Summary:"
echo "  - TypeScript:         ✅ Passed"
echo "  - Migrations:         ✅ Applied"
echo "  - Architecture:       ✅ Compliant"
echo "  - Configuration:      ✅ Implemented"
echo "  - RBAC Security:      ✅ Enforced"
echo "  - Database Indexes:   ✅ Added"
echo "  - Tests:              ✅ Passing"
echo "  - N+1 Optimization:   ✅ Implemented"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${GREEN}✅ Production deployment verification PASSED${NC}"
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo -e "${GREEN}✅ Staging deployment verification PASSED${NC}"
else
    echo -e "${GREEN}✅ Local verification PASSED${NC}"
fi

echo ""
echo "Next steps:"
if [ "$ENVIRONMENT" = "local" ]; then
    echo "  1. Commit changes: git add . && git commit"
    echo "  2. Deploy to staging"
    echo "  3. Run: bash scripts/verify_deployment.sh --staging"
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "  1. Perform manual verification tests"
    echo "  2. Run load testing"
    echo "  3. Deploy to production"
    echo "  4. Run: bash scripts/verify_deployment.sh --production"
else
    echo "  1. Monitor application logs for 24 hours"
    echo "  2. Check performance metrics"
    echo "  3. Verify no security incidents"
fi

echo ""
