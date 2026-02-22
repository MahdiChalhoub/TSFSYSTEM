#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# package-kernel.sh — Package the backend kernel (Blanc Engine)
#
# Linux equivalent of package_kernel.ps1
# Creates: releases/v<VERSION>.kernel.zip
#
# Usage:
#   bash scripts/package-kernel.sh              # uses version from erp settings
#   bash scripts/package-kernel.sh 2.8.0        # explicit version
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Version ───────────────────────────────────────────────────────────────────
VERSION="${1:-$(grep -o '"version": *"[^"]*"' package.json | head -1 | sed 's/"version": *"//;s/"$//')}"
OUTPUT_DIR="releases"
OUTPUT_FILE="$OUTPUT_DIR/v${VERSION}.kernel.zip"
STAGING_DIR="tmp/kernel_packaging_${VERSION}"

echo -e "${CYAN}[PACKAGING]${NC} Blanc Engine — Backend Kernel v${VERSION}"

# ── 1. Clean staging ─────────────────────────────────────────────────────────
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# ── 2. Copy kernel files ─────────────────────────────────────────────────────
echo "[COPY] Copying kernel files..."
cp -r erp_backend/erp "$STAGING_DIR/erp"
cp erp_backend/manage.py "$STAGING_DIR/manage.py"
cp erp_backend/requirements.txt "$STAGING_DIR/requirements.txt"

# Copy lib/ if exists
if [[ -d "erp_backend/lib" ]]; then
    cp -r erp_backend/lib "$STAGING_DIR/lib"
fi

# Remove __pycache__
find "$STAGING_DIR" -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$STAGING_DIR" -name "*.pyc" -delete 2>/dev/null || true

# ── 3. Generate manifest ─────────────────────────────────────────────────────
cat > "$STAGING_DIR/update.json" <<EOF
{
    "version": "$VERSION",
    "type": "kernel",
    "name": "Blanc Engine — Backend Kernel",
    "changelog": "Backend kernel update v$VERSION",
    "release_date": "$(date '+%Y-%m-%d')",
    "requires_restart": true,
    "included_dirs": ["erp", "lib"]
}
EOF

# ── 4. Create ZIP ─────────────────────────────────────────────────────────────
mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_FILE"
echo "[ZIP] Creating ZIP package..."
(cd "$STAGING_DIR" && zip -rq "$PROJECT_ROOT/$OUTPUT_FILE" .)

# ── 5. Cleanup ────────────────────────────────────────────────────────────────
rm -rf "$STAGING_DIR"

# ── 6. Report ─────────────────────────────────────────────────────────────────
SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo ""
echo -e "${GREEN}[SUCCESS]${NC} Backend Kernel v${VERSION} packaged!"
echo -e "   Output: ${BOLD}$OUTPUT_FILE${NC} ($SIZE)"
echo ""
echo -e "${YELLOW}[NEXT STEPS]${NC}"
echo "   1. Go to SaaS Admin → Packages"
echo "   2. Upload the ZIP file"
echo "   3. Click 'Apply' to deploy"
echo "   — OR —"
echo "   scp $OUTPUT_FILE root@91.99.186.183:/root/TSFSYSTEM/releases/"
