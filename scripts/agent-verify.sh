#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TSF Agent Quality Gate — Full Verification Pipeline
# ═══════════════════════════════════════════════════════════
# Run this before declaring ANY task "done".
# Usage: bash scripts/agent-verify.sh [module]
# Example: bash scripts/agent-verify.sh pos
# ═══════════════════════════════════════════════════════════

MODULE=${1:-""}
ERRORS=0

echo "═══════════════════════════════════════════════════════"
echo "  TSF AGENT VERIFICATION PIPELINE"
echo "  Module filter: ${MODULE:-ALL}"
echo "  Time: $(date +%Y-%m-%d\ %H:%M:%S)"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Business Logic Tests ───
echo "▸ Step 1/5: Business Logic Tests..."
node scripts/run-tests.js > /tmp/tsf-test-output.txt 2>&1
if [ $? -ne 0 ]; then
    echo "  ❌ Business logic tests FAILED"
    cat /tmp/tsf-test-output.txt
    ERRORS=$((ERRORS + 1))
else
    PASSED=$(grep "passed" /tmp/tsf-test-output.txt | grep -oP '\d+ passed')
    echo "  ✅ $PASSED"
fi
echo ""

# ─── Step 2: TypeScript Check ───
echo "▸ Step 2/5: TypeScript Check..."
if [ -n "$MODULE" ]; then
    TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep "^src/" | grep -i "$MODULE" | head -20)
else
    TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep "^src/" | head -30)
fi

if [ -n "$TS_ERRORS" ]; then
    ERROR_COUNT=$(echo "$TS_ERRORS" | wc -l)
    echo "  ❌ $ERROR_COUNT TypeScript error(s):"
    echo "$TS_ERRORS" | sed 's/^/    /'
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ Zero TypeScript errors"
fi
echo ""

# ─── Step 3: Code Quality Warnings ───
echo "▸ Step 3/5: Code Quality Scan..."
WARNINGS=0

# Check for console.log in src/
CONSOLE_COUNT=$(grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v "scripts/" | wc -l)
if [ "$CONSOLE_COUNT" -gt 0 ]; then
    echo "  ⚠️  $CONSOLE_COUNT console.log statements found"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for 'as any' casts
ANY_COUNT=$(grep -rn "as any" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$ANY_COUNT" -gt 0 ]; then
    echo "  ⚠️  $ANY_COUNT 'as any' type casts found"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for placeholder functions
PLACEHOLDER_COUNT=$(grep -rn "console\.log.*todo\|() => {}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l)
if [ "$PLACEHOLDER_COUNT" -gt 0 ]; then
    echo "  ⚠️  $PLACEHOLDER_COUNT placeholder/empty handlers found"
    WARNINGS=$((WARNINGS + 1))
fi

if [ "$WARNINGS" -eq 0 ]; then
    echo "  ✅ No quality warnings"
fi
echo ""

# ─── Step 4: Security Scan ───
echo "▸ Step 4/5: Security Scan..."
node scripts/security-scan.js > /tmp/tsf-security-output.txt 2>&1
if [ $? -ne 0 ]; then
    echo "  ❌ Security scan found CRITICAL issues"
    grep -E "CRITICAL|❌" /tmp/tsf-security-output.txt | sed 's/^/    /'
    ERRORS=$((ERRORS + 1))
else
    SEC_PASSED=$(grep "passed" /tmp/tsf-security-output.txt | grep -oP '\d+ passed')
    SEC_WARN=$(grep "warnings" /tmp/tsf-security-output.txt | grep -oP '\d+ warning' || echo "0 warning")
    echo "  ✅ $SEC_PASSED, $SEC_WARN(s)"
fi
echo ""

# ─── Step 5: Build Check ───
echo "▸ Step 5/5: Build Check..."
npx next build > /tmp/tsf-build-output.txt 2>&1
if [ $? -ne 0 ]; then
    echo "  ❌ Build FAILED"
    tail -20 /tmp/tsf-build-output.txt | sed 's/^/    /'
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ Build succeeded"
fi
echo ""

# ─── Final Report ───
echo "═══════════════════════════════════════════════════════"
if [ "$ERRORS" -gt 0 ]; then
    echo "  ❌ VERIFICATION FAILED — $ERRORS critical error(s)"
    echo "  Fix the errors above before declaring task done."
    echo "═══════════════════════════════════════════════════════"
    exit 1
else
    echo "  ✅ ALL CHECKS PASSED"
    if [ "$WARNINGS" -gt 0 ]; then
        echo "  ⚠️  $WARNINGS warning(s) — review but not blocking"
    fi
    echo "═══════════════════════════════════════════════════════"
    exit 0
fi
