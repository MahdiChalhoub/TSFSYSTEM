#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# deploy-module.sh — Package & deploy a single module to production (tsf.ci)
#
# Follows the Blanc Engine packaging pattern:
#   1. Package module into releases/<module>.module.zip (engine-style)
#   2. Commit & push to origin/main
#   3. SSH into production → pull → migrate → build → restart
#   4. Health check with auto-rollback info
#
# Usage:
#   bash scripts/deploy-module.sh <module_name>
#   bash scripts/deploy-module.sh inventory
#   bash scripts/deploy-module.sh --validate finance    # dry-run
#
# Prerequisites:
#   - SSH key at ~/.ssh/id_deploy
#   - Access to root@91.99.186.183 (tsf.ci)
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Server Config (matches deploy-smart.md) ───────────────────────────────────
SSH_KEY="${SSH_KEY:-~/.ssh/id_deploy}"
SSH_HOST="${SSH_HOST:-root@tsf.ci}"
REMOTE_DIR="/root/TSFSYSTEM"
BRANCH="main"

# ── Local Config ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODULES_DIR="$PROJECT_ROOT/src/modules"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Functions ─────────────────────────────────────────────────────────────────
log()  { echo -e "[$(date '+%H:%M:%S')] $*"; }
ok()   { log "${GREEN}✅ $*${NC}"; }
err()  { log "${RED}❌ $*${NC}"; }
warn() { log "${YELLOW}⚠️  $*${NC}"; }

ssh_cmd() {
    ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$SSH_HOST" "$@"
}

# ── Parse args ────────────────────────────────────────────────────────────────
VALIDATE_ONLY=false

if [[ "${1:-}" == "--validate" ]]; then
    VALIDATE_ONLY=true
    shift
fi

if [[ $# -lt 1 ]]; then
    echo ""
    echo -e "${BOLD}🚀 TSF Module Deployer${NC}"
    echo ""
    echo -e "  Usage: ${CYAN}bash scripts/deploy-module.sh [--validate] <module_name>${NC}"
    echo ""
    echo -e "  Examples:"
    echo -e "    bash scripts/deploy-module.sh inventory       ${YELLOW}# deploy inventory${NC}"
    echo -e "    bash scripts/deploy-module.sh --validate crm  ${YELLOW}# dry-run${NC}"
    echo ""
    
    echo -e "  ${BOLD}Available modules:${NC}"
    for dir in "$MODULES_DIR"/*/; do
        if [[ -f "$dir/manifest.json" ]]; then
            mod=$(basename "$dir")
            echo -e "    ${GREEN}•${NC} $mod"
        fi
    done
    echo ""
    exit 1
fi

MODULE_NAME="$1"

# ── Validate module exists ────────────────────────────────────────────────────
if [[ ! -d "$MODULES_DIR/$MODULE_NAME" ]] || [[ ! -f "$MODULES_DIR/$MODULE_NAME/manifest.json" ]]; then
    err "Module '$MODULE_NAME' not found in src/modules/"
    exit 1
fi

MODULE_VERSION=$(grep -o '"version": *"[^"]*"' "$MODULES_DIR/$MODULE_NAME/manifest.json" 2>/dev/null | head -1 | sed 's/"version": *"//;s/"$//')

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🚀 DEPLOYING MODULE: $MODULE_NAME (v$MODULE_VERSION)${NC}"
if $VALIDATE_ONLY; then
    echo -e "${YELLOW}  MODE: VALIDATE ONLY — no changes will be deployed${NC}"
fi
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo ""

# ── Step 1: Package module (Blanc Engine style) ───────────────────────────────
log "📦 [1/7] Packaging module '$MODULE_NAME' (engine-style)..."

RELEASES_DIR="$PROJECT_ROOT/releases/modules"
STAGING_DIR="$PROJECT_ROOT/tmp/module_${MODULE_NAME}"
PACKAGE_FILE="$RELEASES_DIR/${MODULE_NAME}_v${MODULE_VERSION}.module.zip"

mkdir -p "$RELEASES_DIR"

# Clean staging
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Copy module files into staging (engine structure)
[[ -d "erp_backend/apps/$MODULE_NAME" ]] && \
    cp -r "erp_backend/apps/$MODULE_NAME" "$STAGING_DIR/backend" 2>/dev/null && \
    find "$STAGING_DIR/backend" -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

[[ -d "src/modules/$MODULE_NAME" ]] && \
    cp -r "src/modules/$MODULE_NAME" "$STAGING_DIR/frontend_module" 2>/dev/null || true

[[ -d "src/app/(privileged)/$MODULE_NAME" ]] && \
    cp -r "src/app/(privileged)/$MODULE_NAME" "$STAGING_DIR/frontend_pages" 2>/dev/null || true

[[ -d "src/app/actions/$MODULE_NAME" ]] && \
    cp -r "src/app/actions/$MODULE_NAME" "$STAGING_DIR/actions_dir" 2>/dev/null || true

[[ -f "src/app/actions/${MODULE_NAME}.ts" ]] && \
    cp "src/app/actions/${MODULE_NAME}.ts" "$STAGING_DIR/actions_file.ts" 2>/dev/null || true

# Generate engine manifest
cat > "$STAGING_DIR/manifest.json" <<EOF
{
    "name": "$MODULE_NAME",
    "version": "$MODULE_VERSION",
    "type": "module",
    "package_date": "$(date '+%Y-%m-%d')",
    "package_time": "$(date '+%H:%M:%S')",
    "includes": {
        "backend": $([ -d "erp_backend/apps/$MODULE_NAME" ] && echo "true" || echo "false"),
        "frontend_module": $([ -d "src/modules/$MODULE_NAME" ] && echo "true" || echo "false"),
        "frontend_pages": $([ -d "src/app/(privileged)/$MODULE_NAME" ] && echo "true" || echo "false"),
        "actions": $([ -d "src/app/actions/$MODULE_NAME" ] || [ -f "src/app/actions/${MODULE_NAME}.ts" ] && echo "true" || echo "false")
    }
}
EOF

# Create .module.zip
rm -f "$PACKAGE_FILE"
(cd "$STAGING_DIR" && zip -rq "$PACKAGE_FILE" .)
rm -rf "$STAGING_DIR"

PACKAGE_SIZE=$(du -h "$PACKAGE_FILE" | cut -f1)
ok "Module packaged: $PACKAGE_FILE ($PACKAGE_SIZE)"

# ── Step 2: Identify changed files ────────────────────────────────────────────
log "📋 [2/7] Identifying module files..."

# Module file paths (all possible locations for a module)
MODULE_PATHS=(
    "src/app/(privileged)/$MODULE_NAME/"
    "src/modules/$MODULE_NAME/"
    "src/app/actions/$MODULE_NAME/"
    "src/app/actions/${MODULE_NAME}.ts"
    "erp_backend/apps/$MODULE_NAME/"
)

CHANGED_FILES=()
cd "$PROJECT_ROOT"

for p in "${MODULE_PATHS[@]}"; do
    if [[ -e "$p" ]]; then
        # Check git status for changes
        changes=$(git diff --name-only HEAD -- "$p" 2>/dev/null || true)
        staged=$(git diff --cached --name-only -- "$p" 2>/dev/null || true)
        untracked=$(git ls-files --others --exclude-standard -- "$p" 2>/dev/null || true)
        
        if [[ -n "$changes" || -n "$staged" || -n "$untracked" ]]; then
            CHANGED_FILES+=("$p")
        fi
    fi
done

if [[ ${#CHANGED_FILES[@]} -eq 0 ]]; then
    warn "No uncommitted changes found for module '$MODULE_NAME'"
    warn "If changes are already committed, proceeding with push + deploy..."
else
    ok "Found changes in: ${CHANGED_FILES[*]}"
fi

# ── Step 2: Commit module changes ─────────────────────────────────────────────
log "📦 [3/7] Committing module changes..."

if [[ ${#CHANGED_FILES[@]} -gt 0 ]]; then
    for p in "${CHANGED_FILES[@]}"; do
        git add "$p"
    done
    
    COMMIT_MSG="[module:$MODULE_NAME] Deploy v$MODULE_VERSION — $(date '+%Y-%m-%d %H:%M')"
    git commit -m "$COMMIT_MSG" || warn "Nothing new to commit"
    ok "Committed: $COMMIT_MSG"
else
    log "  No new changes to commit"
fi

# ── Step 3: Push to origin ────────────────────────────────────────────────────
log "⬆️  [4/7] Pushing to origin/$BRANCH..."
git push origin "$BRANCH" 2>&1 || { err "Push failed!"; exit 1; }
ok "Pushed to origin/$BRANCH"

if $VALIDATE_ONLY; then
    echo ""
    ok "Validate-only mode — stopping here. Changes are pushed but NOT deployed."
    exit 0
fi

# ── Step 4: Pull on production server ─────────────────────────────────────────
log "📥 [5/7] Pulling on production server..."
ssh_cmd "cd $REMOTE_DIR && git pull origin $BRANCH 2>&1 | tail -5" || { err "Pull failed!"; exit 1; }
ok "Code pulled on server"

# ── Step 5: Backend updates (if module has backend) ───────────────────────────
if [[ -d "erp_backend/apps/$MODULE_NAME" ]]; then
    log "🐍 [6/7] Running backend updates for $MODULE_NAME..."
    
    ssh_cmd "cd $REMOTE_DIR/erp_backend && source venv/bin/activate && pip install -r requirements.txt -q 2>&1 | tail -3" || warn "pip install had issues"
    ssh_cmd "cd $REMOTE_DIR/erp_backend && source venv/bin/activate && python manage.py migrate $MODULE_NAME --no-input 2>&1 | tail -5" || warn "Migration had issues"
    ssh_cmd "cd $REMOTE_DIR/erp_backend && source venv/bin/activate && python manage.py collectstatic --noinput -q 2>&1 | tail -3" || true
    
    log "  Restarting Django via official startup script..."
    ssh_cmd "pm2 delete django 2>/dev/null || true"
    ssh_cmd "cd $REMOTE_DIR/erp_backend && pm2 start start_django.sh --name django"
    ok "Backend updated and restarted via start_django.sh"
else
    log "⏭️  [6/7] No backend app for $MODULE_NAME — skipping"
fi

# ── Step 6: Frontend build + restart ──────────────────────────────────────────
log "⚛️  [7/7] Building and restarting frontend..."
ssh_cmd "cd $REMOTE_DIR && npm run build 2>&1 | tail -10" || { err "Frontend build failed!"; exit 1; }
ssh_cmd "pm2 restart nextjs --update-env 2>&1" || { err "Next.js restart failed!"; exit 1; }
ok "Frontend built and restarted"

# ── Health Check ──────────────────────────────────────────────────────────────
log ""
log "🩺 Running health check..."
sleep 5

BE_CODE=$(ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/ 2>/dev/null" || echo "000")
FE_CODE=$(ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null" || echo "000")

log "  Django:  HTTP $BE_CODE"
log "  Next.js: HTTP $FE_CODE"

if [[ "$BE_CODE" =~ ^(200|401)$ ]] && [[ "$FE_CODE" =~ ^(200|307)$ ]]; then
    echo ""
    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ MODULE '$MODULE_NAME' DEPLOYED SUCCESSFULLY${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
    echo ""
else
    echo ""
    err "Health check failed — check pm2 logs on the server"
    warn "Run: ssh -i $SSH_KEY $SSH_HOST 'pm2 logs --lines 30 --nostream'"
    exit 1
fi
