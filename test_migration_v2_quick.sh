#!/bin/bash
# Quick verification script for Migration v2.0 System
# Run this after deployment to verify everything is working

echo "🔍 MIGRATION V2.0 - QUICK VERIFICATION"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check backend service
echo "1️⃣  Checking backend service..."
if systemctl is-active --quiet tsfsystem.service; then
    echo -e "   ${GREEN}✅ Backend service is running${NC}"
else
    echo -e "   ${RED}❌ Backend service is NOT running${NC}"
    exit 1
fi

# Test 2: Check database tables
echo ""
echo "2️⃣  Checking database tables..."
TABLE_COUNT=$(sudo -u postgres psql tsfdb -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'migration_v2%';" 2>/dev/null | tr -d ' ')
if [ "$TABLE_COUNT" -eq 3 ]; then
    echo -e "   ${GREEN}✅ All 3 migration tables exist${NC}"
    sudo -u postgres psql tsfdb -c "\dt migration_v2*" 2>/dev/null | grep migration_v2
else
    echo -e "   ${RED}❌ Expected 3 tables, found $TABLE_COUNT${NC}"
    exit 1
fi

# Test 3: Check API endpoint
echo ""
echo "3️⃣  Checking API endpoint..."
API_RESPONSE=$(curl -s http://127.0.0.1:8000/api/migration-v2/jobs/)
if echo "$API_RESPONSE" | grep -q "NOT_AUTHENTICATED"; then
    echo -e "   ${GREEN}✅ API endpoint responding correctly${NC}"
    echo "   Response: $API_RESPONSE"
else
    echo -e "   ${RED}❌ Unexpected API response${NC}"
    echo "   Response: $API_RESPONSE"
    exit 1
fi

# Test 4: Check module loaded in logs
echo ""
echo "4️⃣  Checking module registration in logs..."
if tail -100 /var/log/tsfsystem-error.log | grep -q "migration_v2"; then
    echo -e "   ${GREEN}✅ Module registered in backend logs${NC}"
    tail -100 /var/log/tsfsystem-error.log | grep migration_v2 | tail -2
else
    echo -e "   ${YELLOW}⚠️  No recent migration_v2 log entries${NC}"
fi

# Test 5: Check table schemas
echo ""
echo "5️⃣  Checking table schemas..."
JOB_COLUMNS=$(sudo -u postgres psql tsfdb -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'migration_v2_job';" 2>/dev/null | tr -d ' ')
MAPPING_COLUMNS=$(sudo -u postgres psql tsfdb -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'migration_v2_mapping';" 2>/dev/null | tr -d ' ')

echo "   - migration_v2_job: $JOB_COLUMNS columns"
echo "   - migration_v2_mapping: $MAPPING_COLUMNS columns"

if [ "$JOB_COLUMNS" -gt 30 ] && [ "$MAPPING_COLUMNS" -gt 10 ]; then
    echo -e "   ${GREEN}✅ Table schemas look correct${NC}"
else
    echo -e "   ${RED}❌ Table schemas incomplete${NC}"
    exit 1
fi

# Summary
echo ""
echo "========================================"
echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
echo ""
echo "📋 Next Steps:"
echo "   1. Access Django Admin: https://saas.tsf.ci/tsf-system-kernel-7788/"
echo "   2. Look for 'MIGRATION V2' section"
echo "   3. Test creating a migration job"
echo "   4. Or use API with authentication token"
echo ""
echo "📖 Documentation:"
echo "   - MIGRATION_V2_STATUS.md"
echo "   - MIGRATION_V2_TESTING_GUIDE.md"
echo ""
