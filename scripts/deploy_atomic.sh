#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# deploy_atomic.sh — Zero-Downtime Atomic Deployment for TSF Platform
#
# DEPLOY PIPELINE:
#   Phase 1: VALIDATE (nothing goes live)
#     1. Pull latest code into staging area
#     2. Backend validation: pip install, Django check, migrations dry-run
#     3. Frontend validation: npm install, npm run build
#
#   Phase 2: GO LIVE (only if Phase 1 passes)
#     4. Atomic symlink swap
#     5. Graceful service restart
#     6. Post-deploy health check (auto-rollback on failure)
#
# Usage:
#   ./deploy_atomic.sh              # Full deploy
#   ./deploy_atomic.sh --validate   # Validate only (dry-run, no deploy)
#   ./deploy_atomic.sh --rollback   # Rollback to previous release
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
APP_ROOT="/root/TSFSYSTEM"
RELEASES_DIR="/root/releases"
CURRENT_LINK="/root/current"           # Symlink → active release
BRANCH="main"
MAX_RELEASES=5                          # Keep last N releases for rollback
HEALTH_URL_FRONTEND="https://tsf.ci"
HEALTH_URL_BACKEND="https://api.tsf.ci/api/auth/config/"
HEALTH_TIMEOUT=30                       # Seconds to wait for health check
LOG_FILE="/var/log/tsf-deploy.log"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NEW_RELEASE="$RELEASES_DIR/$TIMESTAMP"
VALIDATE_ONLY=false
ERRORS=0

# ── Logging ───────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
err()  { log "❌ ERROR: $*"; ERRORS=$((ERRORS + 1)); }
ok()   { log "✅ $*"; }
warn() { log "⚠️  WARNING: $*"; }
gate() {
    if [[ $ERRORS -gt 0 ]]; then
        log ""
        err "═══════════════════════════════════════════════════"
        err "  DEPLOY ABORTED — $ERRORS error(s) in pre-validation"
        err "  Nothing was deployed. Production is unchanged."
        err "═══════════════════════════════════════════════════"
        # Cleanup failed release directory
        rm -rf "$NEW_RELEASE" 2>/dev/null || true
        exit 1
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# MODE SELECTION
# ══════════════════════════════════════════════════════════════════════════════
if [[ "${1:-}" == "--rollback" ]]; then
    log "🔄 ROLLBACK requested..."
    PREVIOUS=$(ls -1t "$RELEASES_DIR" | sed -n '2p')
    if [[ -z "$PREVIOUS" ]]; then
        err "No previous release found to rollback to!"
        exit 1
    fi
    log "Rolling back to: $PREVIOUS"
    ln -sfn "$RELEASES_DIR/$PREVIOUS" "$CURRENT_LINK"
    pm2 restart all
    ok "Rollback complete → $PREVIOUS"
    exit 0
fi

if [[ "${1:-}" == "--validate" ]]; then
    VALIDATE_ONLY=true
    log "🔍 VALIDATE-ONLY mode — no deployment will happen"
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1: PRE-DEPLOY VALIDATION (nothing goes live)
# ══════════════════════════════════════════════════════════════════════════════
log ""
log "═══════════════════════════════════════════════════"
log "  PHASE 1: PRE-DEPLOY VALIDATION — $TIMESTAMP"
log "═══════════════════════════════════════════════════"
log ""

# ── Step 1: Pull Latest Code ──────────────────────────────────────────────────
log "📥 [1/6] Pulling latest code from $BRANCH..."
cd "$APP_ROOT"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Create staging release directory
mkdir -p "$NEW_RELEASE"
rsync -a --exclude 'node_modules' --exclude '.git' --exclude 'venv' \
    --exclude '__pycache__' --exclude '.next' \
    "$APP_ROOT/" "$NEW_RELEASE/"
ok "Code pulled and staged at $NEW_RELEASE"

# ── Step 2: Backend Validation ────────────────────────────────────────────────
log ""
log "🐍 [2/6] Validating Backend..."
cd "$NEW_RELEASE/erp_backend"

# Link shared venv
if [ ! -L "$NEW_RELEASE/erp_backend/venv" ]; then
    ln -s "$APP_ROOT/erp_backend/venv" "$NEW_RELEASE/erp_backend/venv"
fi
source venv/bin/activate

# 2a. Install dependencies
log "  📦 Installing Python dependencies..."
if pip install -r requirements.txt -q 2>&1 | tail -n 3; then
    ok "  Python dependencies installed"
else
    err "  pip install failed! Check requirements.txt"
fi

# 2b. Django system check (catches model errors, missing fields, etc.)
log "  🔍 Running Django system check..."
if python manage.py check 2>&1 | tail -n 5; then
    ok "  Django system check passed"
else
    err "  Django system check FAILED! Fix model/config errors before deploying."
fi

# 2c. Migrations dry-run (check if migrations are valid without applying)
log "  🗃️  Checking migrations..."
if python manage.py showmigrations 2>&1 | grep -q "\[ \]"; then
    log "  📋 Pending migrations found:"
    python manage.py showmigrations 2>&1 | grep "\[ \]" | head -10
    # Try a dry-run migrate to catch schema errors
    if python manage.py migrate --plan 2>&1 | tail -n 5; then
        ok "  Migration plan validated"
    else
        err "  Migration plan has errors! Fix before deploying."
    fi
else
    ok "  No pending migrations"
fi

# 2d. Ensure platform command check
log "  👤 Verifying ensure_platform..."
if python manage.py ensure_platform 2>&1 | tail -n 5; then
    ok "  Platform integrity verified"
else
    warn "  ensure_platform had issues (non-fatal)"
fi

gate  # ← ABORT if any backend errors

# ── Step 3: Frontend Validation ───────────────────────────────────────────────
log ""
log "⚛️  [3/6] Validating Frontend..."
cd "$NEW_RELEASE"

# Link shared node_modules
if [ ! -L "$NEW_RELEASE/node_modules" ]; then
    ln -s "$APP_ROOT/node_modules" "$NEW_RELEASE/node_modules"
fi

# 3a. Build Next.js (this catches TypeScript errors, import errors, etc.)
log "  🔨 Building Next.js application..."
BUILD_OUTPUT=$(npm run build 2>&1) || {
    err "  Frontend build FAILED!"
    echo "$BUILD_OUTPUT" | tail -20
    echo "$BUILD_OUTPUT" | tail -20 >> "$LOG_FILE"
}

if [[ $ERRORS -eq 0 ]]; then
    ok "  Frontend build succeeded"
    echo "$BUILD_OUTPUT" | tail -5
fi

gate  # ← ABORT if any frontend errors

# ══════════════════════════════════════════════════════════════════════════════
# VALIDATION COMPLETE
# ══════════════════════════════════════════════════════════════════════════════
log ""
log "═══════════════════════════════════════════════════"
log "  ✅ PHASE 1 COMPLETE — All validations passed!"
log "═══════════════════════════════════════════════════"
log ""

if [[ "$VALIDATE_ONLY" == true ]]; then
    ok "Validate-only mode. Cleaning up staging..."
    rm -rf "$NEW_RELEASE"
    log "✅ Dry-run successful. Safe to deploy."
    exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: GO LIVE (only reached if all validations pass)
# ══════════════════════════════════════════════════════════════════════════════
log "═══════════════════════════════════════════════════"
log "  PHASE 2: GOING LIVE"
log "═══════════════════════════════════════════════════"
log ""

# ── Step 4: Apply Migrations (for real) ───────────────────────────────────────
log "🗃️  [4/6] Applying migrations..."
cd "$NEW_RELEASE/erp_backend"
source venv/bin/activate
python manage.py migrate --no-input 2>&1 | tail -n 5
python manage.py collectstatic --noinput -q 2>&1 | tail -n 2
ok "Migrations applied"

# ── Step 5: Atomic Symlink Swap ───────────────────────────────────────────────
log "🔗 [5/6] Performing atomic symlink swap..."
OLD_RELEASE=$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "none")
log "  Old release: $OLD_RELEASE"
log "  New release: $NEW_RELEASE"

# Atomic swap: create temp link then rename (atomic on Linux)
ln -sfn "$NEW_RELEASE" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
ok "Symlink swapped: $CURRENT_LINK → $NEW_RELEASE"

# ── Step 6: Graceful Service Restart ──────────────────────────────────────────
log "♻️  [6/6] Graceful service restart..."

# Gunicorn graceful reload
GUNICORN_PID=$(pgrep -f 'gunicorn.*core.wsgi' | head -1 || true)
if [[ -n "$GUNICORN_PID" ]]; then
    log "  Sending SIGHUP to Gunicorn (PID: $GUNICORN_PID)..."
    kill -HUP "$GUNICORN_PID"
    ok "  Gunicorn workers reloading gracefully"
else
    log "  Gunicorn not found via pgrep, using PM2 restart..."
    pm2 restart django 2>/dev/null || true
fi

# Restart Next.js
pm2 restart nextjs 2>/dev/null || true
ok "  Frontend restarted"

# ── Post-Deploy Health Check with Auto-Rollback ───────────────────────────────
log ""
log "🩺 Running post-deploy health check..."
sleep 3  # Give services time to start

BACKEND_OK=false
FRONTEND_OK=false

for i in $(seq 1 $HEALTH_TIMEOUT); do
    # Check backend
    if ! $BACKEND_OK; then
        BE_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL_BACKEND" 2>/dev/null || echo "000")
        if [[ "$BE_CODE" == "200" ]]; then
            BACKEND_OK=true
            ok "  Backend health: HTTP $BE_CODE"
        fi
    fi

    # Check frontend
    if ! $FRONTEND_OK; then
        FE_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL_FRONTEND" 2>/dev/null || echo "000")
        if [[ "$FE_CODE" == "200" ]]; then
            FRONTEND_OK=true
            ok "  Frontend health: HTTP $FE_CODE"
        fi
    fi

    if $BACKEND_OK && $FRONTEND_OK; then
        break
    fi
    sleep 1
done

if $BACKEND_OK && $FRONTEND_OK; then
    ok "Both services healthy!"
else
    err "Health check FAILED after ${HEALTH_TIMEOUT}s"
    [[ "$BACKEND_OK" == false ]] && err "  Backend: NOT RESPONDING"
    [[ "$FRONTEND_OK" == false ]] && err "  Frontend: NOT RESPONDING"

    log "🔄 AUTO-ROLLBACK triggered..."
    if [[ "$OLD_RELEASE" != "none" && -d "$OLD_RELEASE" ]]; then
        ln -sfn "$OLD_RELEASE" "${CURRENT_LINK}.tmp"
        mv -Tf "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
        pm2 restart all
        ok "Rolled back to: $OLD_RELEASE"
    else
        err "No previous release to rollback to! Manual intervention required."
    fi
    exit 1
fi

# ── Cleanup Old Releases ─────────────────────────────────────────────────────
log ""
log "🧹 Cleaning old releases (keeping last $MAX_RELEASES)..."
cd "$RELEASES_DIR"
ls -1t | tail -n +$((MAX_RELEASES + 1)) | xargs -r rm -rf
ok "Cleanup complete"

# ── Summary ───────────────────────────────────────────────────────────────────
log ""
log "═══════════════════════════════════════════════════"
log "  ✅ DEPLOYMENT SUCCESSFUL"
log "  Release:  $TIMESTAMP"
log "  Symlink:  $CURRENT_LINK → $NEW_RELEASE"
log "  Backend:  ✅ Healthy"
log "  Frontend: ✅ Healthy"
log "═══════════════════════════════════════════════════"
