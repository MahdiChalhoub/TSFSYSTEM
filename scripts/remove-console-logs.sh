#!/bin/bash
#
# Remove Console Debug Statements
#
# This script comments out console.log statements in production code
# while preserving them for development debugging.
#
# Usage:
#   bash scripts/remove-console-logs.sh [--dry-run]
#
# Options:
#   --dry-run    Show what would be changed without making changes
#

set -e

DRY_RUN=false

if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 DRY RUN MODE - No files will be modified"
fi

echo "🧹 Cleaning console statements from src/ directory..."

# Count console statements before
BEFORE_COUNT=$(grep -r "console\\.log" src/ --include="*.tsx" --include="*.ts" | wc -l || echo "0")
echo "📊 Found $BEFORE_COUNT console.log statements"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "Files that would be modified:"
  grep -r "console\\.log" src/ --include="*.tsx" --include="*.ts" -l | head -20
  exit 0
fi

# Comment out console.log statements
# This uses sed to replace console.log( with // console.log(
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i 's/^[[:space:]]*console\.log(/\/\/ console.log(/g' {} +

# Comment out console.debug statements
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i 's/^[[:space:]]*console\.debug(/\/\/ console.debug(/g' {} +

# Comment out console.warn statements (but keep console.error for error handling)
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i 's/^[[:space:]]*console\.warn(/\/\/ console.warn(/g' {} +

# Count console statements after
AFTER_COUNT=$(grep -r "console\\.log" src/ --include="*.tsx" --include="*.ts" | grep -v "^[[:space:]]*//" | wc -l || echo "0")

echo "✅ Cleanup complete!"
echo "📊 Remaining uncommented console.log: $AFTER_COUNT"
echo "🎯 Cleaned: $(($BEFORE_COUNT - $AFTER_COUNT)) statements"

# Generate report
echo ""
echo "📝 Generating report..."
{
  echo "# Console Statement Cleanup Report"
  echo "**Date**: $(date +%Y-%m-%d)"
  echo ""
  echo "## Summary"
  echo "- **Before**: $BEFORE_COUNT console statements"
  echo "- **After**: $AFTER_COUNT console statements"
  echo "- **Cleaned**: $(($BEFORE_COUNT - $AFTER_COUNT)) statements"
  echo ""
  echo "## Remaining console statements"
  echo "These are likely intentional (error handling, etc.):"
  echo ""
  grep -r "console\\." src/ --include="*.tsx" --include="*.ts" -n | grep -v "^[[:space:]]*//" | head -50
} > docs/audits/console-cleanup-report.txt

echo "📄 Report saved to docs/audits/console-cleanup-report.txt"
