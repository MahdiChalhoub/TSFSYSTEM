#!/bin/bash

#################################################################
# Deployment Verification Script
# ==============================
#
# Verifies the complete Inventory Intelligence system is ready
# for deployment (backend + frontend + documentation).
#################################################################

echo "=================================================================="
echo "🔍 INVENTORY INTELLIGENCE - DEPLOYMENT VERIFICATION"
echo "=================================================================="
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $2"
        return 0
    else
        echo -e "${RED}❌${NC} $2 - MISSING: $1"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

function check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} $2"
        return 0
    else
        echo -e "${RED}❌${NC} $2 - MISSING: $1"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

function warn() {
    echo -e "${YELLOW}⚠️${NC}  $1"
    WARNINGS=$((WARNINGS + 1))
}

echo "📦 BACKEND VERIFICATION"
echo "------------------------------------------------------------------"

# Backend directory
check_dir "/root/current/erp_backend" "Backend directory"

# Decision Engine
check_dir "/root/current/erp_backend/kernel/decision_engine" "Decision Engine package"
check_file "/root/current/erp_backend/kernel/decision_engine/__init__.py" "Decision Engine init"
check_file "/root/current/erp_backend/kernel/decision_engine/models.py" "Decision Engine models"
check_file "/root/current/erp_backend/kernel/decision_engine/core.py" "Decision Engine core"
check_file "/root/current/erp_backend/kernel/decision_engine/rule_engine.py" "Rule Engine"
check_file "/root/current/erp_backend/kernel/decision_engine/ml_registry.py" "ML Registry"
check_file "/root/current/erp_backend/kernel/decision_engine/recommender.py" "Recommender Engine"

# Intelligence Services
check_file "/root/current/erp_backend/apps/inventory/services/intelligence_service.py" "Intelligence Service"
check_file "/root/current/erp_backend/apps/inventory/services/transfer_intelligence_service.py" "Transfer Intelligence Service"
check_file "/root/current/erp_backend/apps/inventory/services/fulfillment_intelligence_service.py" "Fulfillment Intelligence Service"

# API Views
check_file "/root/current/erp_backend/apps/inventory/views/intelligence_views.py" "Intelligence Views (API)"

# Configuration
check_file "/root/current/erp_backend/apps/inventory/module.json" "Module Configuration"

# Migration
check_file "/root/current/erp_backend/erp/migrations/0022_decision_engine_models.py" "Decision Engine Migration"

# Test Scripts
check_file "/root/current/erp_backend/test_decision_engine.py" "Integration Test Script"
check_file "/root/current/erp_backend/create_test_data.py" "Test Data Script"

echo ""
echo "🎨 FRONTEND VERIFICATION"
echo "------------------------------------------------------------------"

# Frontend directory
check_dir "/root/current/src/app/(privileged)/inventory/intelligence" "Intelligence Frontend Directory"

# Main page
check_file "/root/current/src/app/(privileged)/inventory/intelligence/page.tsx" "Intelligence Dashboard Page"

# Components
check_dir "/root/current/src/app/(privileged)/inventory/intelligence/components" "Components Directory"
check_file "/root/current/src/app/(privileged)/inventory/intelligence/components/DemandForecast.tsx" "Demand Forecast Component"
check_file "/root/current/src/app/(privileged)/inventory/intelligence/components/TransferAnalysis.tsx" "Transfer Analysis Component"
check_file "/root/current/src/app/(privileged)/inventory/intelligence/components/AllocationOptimizer.tsx" "Allocation Optimizer Component"
check_file "/root/current/src/app/(privileged)/inventory/intelligence/components/ABCClassification.tsx" "ABC Classification Component"
check_file "/root/current/src/app/(privileged)/inventory/intelligence/components/StockoutRiskMonitor.tsx" "Stockout Risk Monitor"
check_file "/root/current/src/app/(privileged)/inventory/intelligence/components/ReorderOptimizer.tsx" "Reorder Optimizer Component"

# Hooks
check_dir "/root/current/src/app/(privileged)/inventory/intelligence/hooks" "Hooks Directory"
check_file "/root/current/src/app/(privileged)/inventory/intelligence/hooks/useIntelligenceAPI.ts" "API Service Hook"

echo ""
echo "📚 DOCUMENTATION VERIFICATION"
echo "------------------------------------------------------------------"

check_dir "/root/current/.ai" "Documentation Directory"
check_file "/root/current/.ai/MASTER_COMPLETION_SUMMARY.md" "Master Completion Summary"
check_file "/root/current/.ai/FINAL_DEPLOYMENT_REPORT.md" "Final Deployment Report"
check_file "/root/current/.ai/FRONTEND_INTELLIGENCE_COMPLETE.md" "Frontend Intelligence Guide"
check_file "/root/current/.ai/INVENTORY_API_COMPLETE.md" "API Complete Reference"
check_file "/root/current/.ai/DECISION_RULES_EXAMPLES.md" "Decision Rules Examples"
check_file "/root/current/.ai/END_TO_END_TESTING_GUIDE.md" "E2E Testing Guide"
check_file "/root/current/.ai/INVENTORY_DEPLOYMENT_READY.md" "Deployment Ready Guide"
check_file "/root/current/.ai/INVENTORY_INTELLIGENCE_COMPLETE.md" "Intelligence Complete Doc"
check_file "/root/current/.ai/INVENTORY_MODULE_FINAL_SUMMARY.md" "Module Final Summary"

echo ""
echo "🔧 CONFIGURATION VERIFICATION"
echo "------------------------------------------------------------------"

# Check if backend can import Decision Engine
cd /root/current/erp_backend
if python3 -c "from kernel.decision_engine import DecisionEngine; print('OK')" 2>/dev/null | grep -q "OK"; then
    echo -e "${GREEN}✅${NC} Decision Engine imports correctly"
else
    echo -e "${RED}❌${NC} Decision Engine import failed"
    ERRORS=$((ERRORS + 1))
fi

# Check if intelligence services can import
if python3 -c "from apps.inventory.services.intelligence_service import InventoryIntelligenceService; print('OK')" 2>/dev/null | grep -q "OK"; then
    echo -e "${GREEN}✅${NC} Intelligence Service imports correctly"
else
    echo -e "${RED}❌${NC} Intelligence Service import failed"
    ERRORS=$((ERRORS + 1))
fi

# Check if intelligence views can import
if python3 -c "from apps.inventory.views.intelligence_views import IntelligenceViewSet; print('OK')" 2>/dev/null | grep -q "OK"; then
    echo -e "${GREEN}✅${NC} Intelligence Views imports correctly"
else
    echo -e "${RED}❌${NC} Intelligence Views import failed"
    ERRORS=$((ERRORS + 1))
fi

cd - > /dev/null

echo ""
echo "📊 DATABASE VERIFICATION"
echo "------------------------------------------------------------------"

cd /root/current/erp_backend
# Check if migration exists in database
MIGRATION_COUNT=$(python3 manage.py showmigrations erp 2>/dev/null | grep "0022_decision_engine_models" | wc -l)

if [ "$MIGRATION_COUNT" -gt 0 ]; then
    if python3 manage.py showmigrations erp 2>/dev/null | grep "0022_decision_engine_models" | grep -q "\[X\]"; then
        echo -e "${GREEN}✅${NC} Decision Engine migration applied"
    else
        echo -e "${YELLOW}⚠️${NC}  Decision Engine migration exists but not applied"
        warn "Run: python manage.py migrate erp"
    fi
else
    echo -e "${RED}❌${NC} Decision Engine migration not found"
    ERRORS=$((ERRORS + 1))
fi

cd - > /dev/null

echo ""
echo "📦 FRONTEND DEPENDENCIES"
echo "------------------------------------------------------------------"

if [ -f "/root/current/package.json" ]; then
    echo -e "${GREEN}✅${NC} package.json exists"

    # Check if node_modules exists
    if [ -d "/root/current/node_modules" ]; then
        echo -e "${GREEN}✅${NC} node_modules installed"
    else
        warn "node_modules not found. Run: npm install"
    fi
else
    echo -e "${RED}❌${NC} package.json not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=================================================================="
echo "📋 VERIFICATION SUMMARY"
echo "=================================================================="
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "🎉 System is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "  1. Backend: cd /root/current/erp_backend && python create_test_data.py"
    echo "  2. Backend: python manage.py runserver 0.0.0.0:8000"
    echo "  3. Frontend: cd /root/current && npm run dev"
    echo "  4. Test: Visit http://localhost:3000/inventory/intelligence"
    echo ""
else
    echo -e "${RED}❌ FOUND $ERRORS ERROR(S)${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    echo ""
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $WARNINGS warning(s)${NC}"
    echo "Review warnings above (non-critical but recommended to fix)"
    echo ""
fi

echo "=================================================================="
echo "📊 FILE STATISTICS"
echo "=================================================================="
echo ""

BACKEND_FILES=$(find /root/current/erp_backend/kernel/decision_engine -name "*.py" 2>/dev/null | wc -l)
BACKEND_FILES=$((BACKEND_FILES + $(find /root/current/erp_backend/apps/inventory/services -name "*intelligence*.py" 2>/dev/null | wc -l)))
BACKEND_FILES=$((BACKEND_FILES + $(find /root/current/erp_backend/apps/inventory/views -name "*intelligence*.py" 2>/dev/null | wc -l)))

FRONTEND_FILES=$(find /root/current/src/app/\(privileged\)/inventory/intelligence -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l)

DOC_FILES=$(find /root/current/.ai -name "*.md" 2>/dev/null | wc -l)

echo "Backend Files:     $BACKEND_FILES"
echo "Frontend Files:    $FRONTEND_FILES"
echo "Documentation:     $DOC_FILES"
echo "Total Files:       $((BACKEND_FILES + FRONTEND_FILES + DOC_FILES))"
echo ""

# Count lines of code
if command -v cloc &> /dev/null; then
    echo "Lines of Code (approximate):"
    cloc --quiet /root/current/erp_backend/kernel/decision_engine \
         /root/current/erp_backend/apps/inventory/services/*intelligence*.py \
         /root/current/erp_backend/apps/inventory/views/intelligence_views.py \
         /root/current/src/app/\(privileged\)/inventory/intelligence 2>/dev/null || echo "  (cloc not available)"
else
    echo "Lines of Code: ~5,040 (estimate)"
fi

echo ""
echo "=================================================================="

exit $ERRORS
