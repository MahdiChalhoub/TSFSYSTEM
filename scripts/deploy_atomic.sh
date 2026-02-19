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

# ── Load Configuration ────────────────────────────────────────────────────────
# Allow overriding configuration via environment variables or a .env file
CONF_FILE="${DEPLOY_CONF:-.deploy.env}"
if [[ -f "$CONF_FILE" ]]; then
    echo "📜 Loading config from $CONF_FILE"
    # shellcheck disable=SC1090
    source "$CONF_FILE"
fi

APP_ROOT="${APP_ROOT:-/root/TSFSYSTEM}"
RELEASES_DIR="${RELEASES_DIR:-/root/releases}"
CURRENT_LINK="${CURRENT_LINK:-/root/current}"
BRANCH="${APP_BRANCH:-main}"
MAX_RELEASES="${MAX_RELEASES:-5}"
HEALTH_URL_FRONTEND="${HEALTH_URL_FRONTEND:-https://tsf.ci}"
HEALTH_URL_BACKEND="${HEALTH_URL_BACKEND:-https://api.tsf.ci/api/auth/config/}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"
LOG_FILE="${LOG_FILE:-/var/log/tsf-deploy.log}"

# Services
BACKEND_SERVICE="${BACKEND_SERVICE:-django}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-nextjs}"

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
    # ls -1t sorts by time, head -2 gets current and previous, tail -1 gets previous
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

# 2b. Django system check
log "  🔍 Running Django system check..."
if python manage.py check 2>&1 | tail -n 5; then
    ok "  Django system check passed"
else
    err "  Django system check FAILED! Fix model/config errors before deploying."
fi

# 2c. Migrations dry-run
log "  🗃️  Checking migrations..."
if python manage.py showmigrations 2>&1 | grep -q "\[ \]"; then
    log "  📋 Pending migrations found:"
    python manage.py showmigrations 2>&1 | grep "\[ \]" | head -10
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

gate

# ── Step 3: Frontend Validation ───────────────────────────────────────────────
log ""
log "⚛️  [3/6] Validating Frontend..."
cd "$NEW_RELEASE"

# Link shared node_modules
if [ ! -L "$NEW_RELEASE/node_modules" ]; then
    ln -s "$APP_ROOT/node_modules" "$NEW_RELEASE/node_modules"
fi

# 3a. Build Next.js
log "  🔨 Building Next.js application..."
BUILD_OUTPUT=$(npm run build 2>&1) || {
    err "  Frontend build FAILED!"
    echo "$BUILD_OUTPUT" | tail -30
    echo "$BUILD_OUTPUT" | tail -30 >> "$LOG_FILE"
}

if [[ $ERRORS -eq 0 ]]; then
    ok "  Frontend build succeeded"
    echo "$BUILD_OUTPUT" | tail -5
fi

gate

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
# PHASE 2: GO LIVE
# ══════════════════════════════════════════════════════════════════════════════
log "═══════════════════════════════════════════════════"
log "  PHASE 2: GOING LIVE"
log "═══════════════════════════════════════════════════"
log ""

# ── Step 4: Apply Migrations ──────────────────────────────────────────────────
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

ln -sfn "$NEW_RELEASE" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
ok "Symlink swapped: $CURRENT_LINK → $NEW_RELEASE"

# ── Step 6: Graceful Service Restart ──────────────────────────────────────────
log "♻️  [6/6] Graceful service restart..."

# Gunicorn graceful reload (if used)
WSGI_PROCESS=$(pgrep -f 'gunicorn.*core.wsgi' | head -1 || true)
if [[ -n "$WSGI_PROCESS" ]]; then
    log "  Sending SIGHUP to Gunicorn (PID: $WSGI_PROCESS)..."
    kill -HUP "$WSGI_PROCESS"
    ok "  Gunicorn workers reloading gracefully"
fi

# PM2 Restarts
if pm2 show "$BACKEND_SERVICE" > /dev/null 2>&1; then
    pm2 restart "$BACKEND_SERVICE" 2>/dev/null
    ok "  Backend ($BACKEND_SERVICE) restarted"
fi

if pm2 show "$FRONTEND_SERVICE" > /dev/null 2>&1; then
    pm2 restart "$FRONTEND_SERVICE" 2>/dev/null
    ok "  Frontend ($FRONTEND_SERVICE) restarted"
fi

# ── Post-Deploy Health Check with Auto-Rollback ───────────────────────────────
log ""
log "🩺 Running post-deploy health check..."
sleep 5  # Give services time to start

BACKEND_OK=false
FRONTEND_OK=false

for i in $(seq 1 "$HEALTH_TIMEOUT"); do
    # Check backend
    if ! $BACKEND_OK; then
        # Use -L to follow redirects if necessary
        BE_CODE=$(curl -s -L -o /dev/null -w '%{http_code}' "$HEALTH_URL_BACKEND" 2>/dev/null || echo "000")
        if [[ "$BE_CODE" == "200" ]]; then
            BACKEND_OK=true
            ok "  Backend health: HTTP $BE_CODE"
        fi
    fi

    # Check frontend
    if ! $FRONTEND_OK; then
        FE_CODE=$(curl -s -L -o /dev/null -w '%{http_code}' "$HEALTH_URL_FRONTEND" 2>/dev/null || echo "000")
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
    [[ "$BACKEND_OK" == false ]] && err "  Backend: NOT RESPONDING ($HEALTH_URL_BACKEND)"
    [[ "$FRONTEND_OK" == false ]] && err "  Frontend: NOT RESPONDING ($HEALTH_URL_FRONTEND)"

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
# shellcheck disable=SC2012
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
