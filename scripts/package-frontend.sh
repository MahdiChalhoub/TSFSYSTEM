#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# package-frontend.sh — Package the frontend kernel (Blanc Engine)
#
# Linux equivalent of package_frontend_kernel.ps1
# Creates: releases/v<VERSION>.frontend.zip
#
# Usage:
#   bash scripts/package-frontend.sh              # uses version from package.json
#   bash scripts/package-frontend.sh 2.8.0        # explicit version
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Version ───────────────────────────────────────────────────────────────────
VERSION="${1:-$(grep -o '"version": *"[^"]*"' package.json | head -1 | sed 's/"version": *"//;s/"$//')}"
OUTPUT_DIR="releases"
OUTPUT_FILE="$OUTPUT_DIR/v${VERSION}.frontend.zip"
STAGING_DIR="tmp/frontend_packaging_${VERSION}"

echo -e "${CYAN}[PACKAGING]${NC} Blanc Engine — Frontend Kernel v${VERSION}"

# ── 1. Build frontend ────────────────────────────────────────────────────────
echo "[BUILD] Running npm run build..."
npm run build || { echo -e "${RED}[ERROR] Build failed!${NC}"; exit 1; }

# ── 2. Clean staging ─────────────────────────────────────────────────────────
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# ── 3. Copy built files ──────────────────────────────────────────────────────
echo "[COPY] Copying frontend files..."
cp -r .next "$STAGING_DIR/.next"
[[ -d public ]] && cp -r public "$STAGING_DIR/public"
cp package.json "$STAGING_DIR/package.json"
[[ -f next.config.ts ]] && cp next.config.ts "$STAGING_DIR/next.config.ts"
[[ -f next.config.js ]] && cp next.config.js "$STAGING_DIR/next.config.js"

# ── 4. Generate manifest ─────────────────────────────────────────────────────
cat > "$STAGING_DIR/frontend_update.json" <<EOF
{
    "version": "$VERSION",
    "type": "frontend",
    "name": "Blanc Engine — Frontend Kernel",
    "changelog": "Frontend kernel update v$VERSION",
    "release_date": "$(date '+%Y-%m-%d')",
    "requires_restart": true,
    "included_dirs": [".next", "public"],
    "node_version": "18+"
}
EOF

# ── 5. Create ZIP ─────────────────────────────────────────────────────────────
mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_FILE"
echo "[ZIP] Creating ZIP package..."
(cd "$STAGING_DIR" && zip -rq "$PROJECT_ROOT/$OUTPUT_FILE" .)

# ── 6. Cleanup ────────────────────────────────────────────────────────────────
rm -rf "$STAGING_DIR"

# ── 7. Report ─────────────────────────────────────────────────────────────────
SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo ""
echo -e "${GREEN}[SUCCESS]${NC} Frontend Kernel v${VERSION} packaged!"
echo -e "   Output: ${BOLD}$OUTPUT_FILE${NC} ($SIZE)"
echo ""
echo -e "${YELLOW}[NEXT STEPS]${NC}"
echo "   1. Go to SaaS Admin → Packages"
echo "   2. Upload the ZIP file"
echo "   3. Click 'Apply' to deploy"
echo "   — OR —"
echo "   scp $OUTPUT_FILE root@91.99.186.183:/root/TSFSYSTEM/releases/"
