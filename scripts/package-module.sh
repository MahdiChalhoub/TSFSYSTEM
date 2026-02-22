#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# package-module.sh — Package a single business module (Blanc Engine)
#
# Creates: releases/modules/<module>_v<VERSION>.module.zip
#
# Usage:
#   bash scripts/package-module.sh inventory       # package inventory
#   bash scripts/package-module.sh finance          # package finance
#   bash scripts/package-module.sh --all            # package ALL modules
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

MODULES_DIR="src/modules"
RELEASES_DIR="releases/modules"
VERSION_LOG="releases/VERSION_HISTORY.md"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Functions ─────────────────────────────────────────────────────────────────
package_module() {
    local MODULE_NAME="$1"
    local CHANGELOG="${2:-"Module update"}"
    local MANIFEST="$MODULES_DIR/$MODULE_NAME/manifest.json"
    
    if [[ ! -f "$MANIFEST" ]]; then
        echo -e "${RED}❌ Module '$MODULE_NAME' has no manifest.json${NC}"
        return 1
    fi

    local VERSION=$(grep -o '"version": *"[^"]*"' "$MANIFEST" | head -1 | sed 's/"version": *"//;s/"$//')
    local NAME=$(grep -o '"name": *"[^"]*"' "$MANIFEST" | head -1 | sed 's/"name": *"//;s/"$//')
    local STAGING="tmp/module_pkg_${MODULE_NAME}"
    local OUTPUT="$RELEASES_DIR/${MODULE_NAME}_v${VERSION}.module.zip"

    echo -e "${CYAN}[PACKAGING]${NC} Module: ${BOLD}$NAME${NC} ($MODULE_NAME v$VERSION)"

    # Clean staging
    rm -rf "$STAGING"
    mkdir -p "$STAGING"

    # ── Copy module components ────────────────────────────────────────────────

    # Backend (Django app)
    if [[ -d "erp_backend/apps/$MODULE_NAME" ]]; then
        cp -r "erp_backend/apps/$MODULE_NAME" "$STAGING/backend"
        find "$STAGING/backend" -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find "$STAGING/backend" -name "*.pyc" -delete 2>/dev/null || true
        echo "   ✅ Backend: erp_backend/apps/$MODULE_NAME/"
    fi

    # Frontend module (manifest, components, types)
    if [[ -d "$MODULES_DIR/$MODULE_NAME" ]]; then
        cp -r "$MODULES_DIR/$MODULE_NAME" "$STAGING/frontend_module"
        echo "   ✅ Frontend module: src/modules/$MODULE_NAME/"
    fi

    # Frontend pages (Next.js routes)
    if [[ -d "src/app/(privileged)/$MODULE_NAME" ]]; then
        cp -r "src/app/(privileged)/$MODULE_NAME" "$STAGING/frontend_pages"
        echo "   ✅ Frontend pages: src/app/(privileged)/$MODULE_NAME/"
    fi

    # Server actions (directory or single file)
    if [[ -d "src/app/actions/$MODULE_NAME" ]]; then
        cp -r "src/app/actions/$MODULE_NAME" "$STAGING/actions"
        echo "   ✅ Actions: src/app/actions/$MODULE_NAME/"
    elif [[ -f "src/app/actions/${MODULE_NAME}.ts" ]]; then
        mkdir -p "$STAGING/actions"
        cp "src/app/actions/${MODULE_NAME}.ts" "$STAGING/actions/${MODULE_NAME}.ts"
        echo "   ✅ Actions: src/app/actions/${MODULE_NAME}.ts"
    fi

    # Documentation
    if [[ -f "DOCUMENTATION/MODULE_${MODULE_NAME^^}.md" ]]; then
        cp "DOCUMENTATION/MODULE_${MODULE_NAME^^}.md" "$STAGING/documentation.md"
    elif [[ -f "DOCUMENTATION/${MODULE_NAME}.md" ]]; then
        cp "DOCUMENTATION/${MODULE_NAME}.md" "$STAGING/documentation.md"
    fi

    # ── Generate package manifest ─────────────────────────────────────────────
    cat > "$STAGING/module_update.json" <<EOF
{
    "name": "$NAME",
    "code": "$MODULE_NAME",
    "version": "$VERSION",
    "type": "module",
    "changelog": "$CHANGELOG",
    "package_date": "$(date '+%Y-%m-%d')",
    "package_time": "$(date '+%H:%M:%S')",
    "requires_restart": true,
    "includes": {
        "backend": $([ -d "erp_backend/apps/$MODULE_NAME" ] && echo "true" || echo "false"),
        "frontend_module": $([ -d "$MODULES_DIR/$MODULE_NAME" ] && echo "true" || echo "false"),
        "frontend_pages": $([ -d "src/app/(privileged)/$MODULE_NAME" ] && echo "true" || echo "false"),
        "actions": $([ -d "src/app/actions/$MODULE_NAME" ] || [ -f "src/app/actions/${MODULE_NAME}.ts" ] && echo "true" || echo "false")
    }
}
EOF

    # ── Create ZIP ────────────────────────────────────────────────────────────
    mkdir -p "$RELEASES_DIR"
    rm -f "$OUTPUT"
    (cd "$STAGING" && zip -rq "$PROJECT_ROOT/$OUTPUT" .)
    rm -rf "$STAGING"

    local SIZE=$(du -h "$OUTPUT" | cut -f1)
    echo -e "   ${GREEN}✅ Packaged:${NC} $OUTPUT ($SIZE)"
    
    # Track in version history
    if [[ ! -f "$VERSION_LOG" ]]; then
        echo "# Blanc Engine — Version History" > "$VERSION_LOG"
        echo "" >> "$VERSION_LOG"
    fi
    echo "## Module: $NAME v$VERSION — $(date '+%Y-%m-%d %H:%M')" >> "$VERSION_LOG"
    echo "- $CHANGELOG" >> "$VERSION_LOG"
    echo "" >> "$VERSION_LOG"
    
    echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

if [[ $# -lt 1 ]]; then
    echo ""
    echo -e "${BOLD}📦 Blanc Engine — Module Packager${NC}"
    echo ""
    echo -e "  Usage: ${CYAN}bash scripts/package-module.sh <module_name>${NC}"
    echo -e "         ${CYAN}bash scripts/package-module.sh --all${NC}"
    echo ""
    echo -e "  ${BOLD}Available modules:${NC}"
    for dir in "$MODULES_DIR"/*/; do
        if [[ -f "$dir/manifest.json" ]]; then
            mod=$(basename "$dir")
            ver=$(grep -o '"version": *"[^"]*"' "$dir/manifest.json" | head -1 | sed 's/"version": *"//;s/"$//')
            echo -e "    ${GREEN}•${NC} ${BOLD}$mod${NC} (v$ver)"
        fi
    done
    echo ""
    exit 1
fi

if [[ "$1" == "--all" ]]; then
    echo ""
    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  📦 PACKAGING ALL MODULES${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
    echo ""
    
    COUNT=0
    for dir in "$MODULES_DIR"/*/; do
        if [[ -f "$dir/manifest.json" ]]; then
            mod=$(basename "$dir")
            package_module "$mod"
            COUNT=$((COUNT + 1))
        fi
    done
    
    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ALL $COUNT MODULES PACKAGED${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Packages in: releases/modules/"
    ls -lh "$RELEASES_DIR"/*.module.zip 2>/dev/null | awk '{print "    " $NF " (" $5 ")"}'
    echo ""
else
    MODULE_NAME="$1"
    if [[ ! -d "$MODULES_DIR/$MODULE_NAME" ]]; then
        echo -e "${RED}❌ Module '$MODULE_NAME' not found in $MODULES_DIR/${NC}"
        exit 1
    fi
    package_module "$MODULE_NAME"
fi
