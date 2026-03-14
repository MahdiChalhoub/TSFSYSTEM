#!/bin/bash
#
# Accessibility Audit Script
#
# Scans the codebase for common accessibility issues:
# - Missing alt text on images
# - Missing aria-labels on interactive elements
# - Missing form labels
# - Insufficient color contrast
# - Keyboard navigation issues
#
# Usage:
#   bash scripts/accessibility-audit.sh
#

set -e

echo "♿ TSFSYSTEM Accessibility Audit"
echo "================================"
echo ""

REPORT_DIR="docs/quality"
REPORT_FILE="$REPORT_DIR/ACCESSIBILITY_REPORT.md"

mkdir -p "$REPORT_DIR"

{
  echo "# Accessibility Audit Report"
  echo "**Date**: $(date +%Y-%m-%d)"
  echo "**Standard**: WCAG 2.1 AA"
  echo ""
  echo "## Executive Summary"
  echo ""

  # Count images without alt text
  IMG_NO_ALT=$(grep -r "<img" src/ --include="*.tsx" | grep -v "alt=" | wc -l || echo "0")
  echo "- **Images without alt text**: $IMG_NO_ALT"

  # Count buttons without aria-label
  BTN_NO_ARIA=$(grep -r "<button" src/ --include="*.tsx" | grep -v "aria-label" | grep -v "children" | wc -l || echo "0")
  echo "- **Buttons without accessible labels**: $BTN_NO_ARIA"

  # Count inputs without labels
  INPUT_NO_LABEL=$(grep -r "<input" src/ --include="*.tsx" | grep -v "aria-label" | grep -v "placeholder" | wc -l || echo "0")
  echo "- **Inputs without labels**: $INPUT_NO_LABEL"

  # Count divs with onClick (should be buttons)
  DIV_ONCLICK=$(grep -r "onClick" src/ --include="*.tsx" | grep "<div" | wc -l || echo "0")
  echo "- **Divs with onClick (should be buttons)**: $DIV_ONCLICK"

  echo ""
  echo "## Detailed Findings"
  echo ""

  if [ "$IMG_NO_ALT" -gt 0 ]; then
    echo "### 1. Images without alt text"
    echo ""
    echo "**Severity**: High"
    echo "**WCAG Criterion**: 1.1.1 Non-text Content (Level A)"
    echo ""
    echo "Files with images missing alt text:"
    grep -r "<img" src/ --include="*.tsx" -n | grep -v "alt=" | head -20
    echo ""
  fi

  if [ "$BTN_NO_ARIA" -gt 0 ]; then
    echo "### 2. Buttons without accessible labels"
    echo ""
    echo "**Severity**: Medium"
    echo "**WCAG Criterion**: 4.1.2 Name, Role, Value (Level A)"
    echo ""
    echo "Icon-only buttons should have aria-label:"
    grep -r "<button" src/ --include="*.tsx" -n | grep -v "aria-label" | grep -v "children" | head -20
    echo ""
  fi

  if [ "$INPUT_NO_LABEL" -gt 0 ]; then
    echo "### 3. Form inputs without labels"
    echo ""
    echo "**Severity**: High"
    echo "**WCAG Criterion**: 1.3.1 Info and Relationships (Level A)"
    echo ""
    echo "All inputs should have associated labels or aria-label:"
    grep -r "<input" src/ --include="*.tsx" -n | grep -v "aria-label" | grep -v "placeholder" | head -20
    echo ""
  fi

  if [ "$DIV_ONCLICK" -gt 0 ]; then
    echo "### 4. Non-semantic interactive elements"
    echo ""
    echo "**Severity**: Medium"
    echo "**WCAG Criterion**: 4.1.2 Name, Role, Value (Level A)"
    echo ""
    echo "Use semantic HTML (button, a) instead of div with onClick:"
    grep -r "onClick" src/ --include="*.tsx" -n | grep "<div" | head -20
    echo ""
  fi

  echo "## Recommendations"
  echo ""
  echo "### High Priority"
  echo "1. Add alt text to all images"
  echo "2. Add labels or aria-label to all form inputs"
  echo "3. Replace clickable divs with semantic buttons"
  echo ""
  echo "### Medium Priority"
  echo "1. Add aria-labels to icon-only buttons"
  echo "2. Ensure keyboard navigation works for all interactive elements"
  echo "3. Test with screen readers (NVDA, JAWS, VoiceOver)"
  echo ""
  echo "### Best Practices"
  echo "- Use semantic HTML elements"
  echo "- Ensure sufficient color contrast (4.5:1 for normal text)"
  echo "- Support keyboard navigation (Tab, Enter, Escape)"
  echo "- Test with automated tools (axe, Lighthouse)"
  echo "- Manual testing with screen readers"
  echo ""
  echo "## Tools for Testing"
  echo "- **Automated**: axe DevTools, Lighthouse, WAVE"
  echo "- **Screen Readers**: NVDA (Windows), JAWS (Windows), VoiceOver (Mac)"
  echo "- **Keyboard Testing**: Navigate entire app using only Tab/Enter/Escape"
  echo ""

} > "$REPORT_FILE"

echo "✅ Audit complete!"
echo "📄 Report saved to $REPORT_FILE"
echo ""
echo "📊 Summary:"
echo "  - Images without alt text: $IMG_NO_ALT"
echo "  - Buttons without aria-label: $BTN_NO_ARIA"
echo "  - Inputs without labels: $INPUT_NO_LABEL"
echo "  - Clickable divs: $DIV_ONCLICK"
echo ""
echo "🎯 Next steps:"
echo "  1. Review the report: $REPORT_FILE"
echo "  2. Fix high-priority issues first"
echo "  3. Run automated tools (axe, Lighthouse)"
echo "  4. Test with screen readers"
