#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# deploy_atomic.sh — Zero-Downtime Atomic Deployment for TSF Platform
#
# This script performs an atomic deployment using symlink swapping.
# It ensures the application is never in a broken state:
#   1. Creates a new release directory with a timestamped name.
#   2. Builds the frontend and backend into the new release.
#   3. Runs health checks on the new version.
#   4. Atomically swaps the symlink to the new release.
#   5. Auto-rolls back if health checks fail.
#
# Usage: ./deploy_atomic.sh [--rollback]
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
APP_ROOT="/root/TSFSYSTEM"
RELEASES_DIR="/root/releases"
CURRENT_LINK="/root/current"           # Symlink → active release
REPO_URL="https://github.com/MahdiChalhoub/TSFSYSTEM.git"
BRANCH="main"
MAX_RELEASES=5                          # Keep last N releases for rollback
HEALTH_URL="https://tsf.ci/api/health/"
HEALTH_TIMEOUT=30                       # Seconds to wait for health check
LOG_FILE="/var/log/tsf-deploy.log"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NEW_RELEASE="$RELEASES_DIR/$TIMESTAMP"

# ── Logging ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
err() { log "❌ ERROR: $*"; }
ok()  { log "✅ $*"; }

# ══════════════════════════════════════════════════════════════════════════════
# ROLLBACK MODE
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

# ══════════════════════════════════════════════════════════════════════════════
# DEPLOY PIPELINE
# ══════════════════════════════════════════════════════════════════════════════
log "═══════════════════════════════════════════════════"
log "  ATOMIC DEPLOY — $TIMESTAMP"
log "═══════════════════════════════════════════════════"

# ── Step 1: Prepare Release Directory ─────────────────────────────────────────
log "📁 [1/7] Creating release directory..."
mkdir -p "$NEW_RELEASE"

# ── Step 2: Pull Latest Code ──────────────────────────────────────────────────
log "⬇️  [2/7] Pulling latest code from $BRANCH..."
cd "$APP_ROOT"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Copy the entire project into the new release
rsync -a --exclude 'node_modules' --exclude '.git' --exclude 'venv' \
    --exclude '__pycache__' --exclude '.next' \
    "$APP_ROOT/" "$NEW_RELEASE/"
ok "Code synced to $NEW_RELEASE"

# ── Step 3: Backend Build ─────────────────────────────────────────────────────
log "🐍 [3/7] Building Backend..."
cd "$NEW_RELEASE/erp_backend"

# Reuse the shared venv (don't rebuild every time)
if [ ! -L "$NEW_RELEASE/erp_backend/venv" ]; then
    ln -s "$APP_ROOT/erp_backend/venv" "$NEW_RELEASE/erp_backend/venv"
fi
source venv/bin/activate

pip install -r requirements.txt -q 2>&1 | tail -n 3
python manage.py migrate --no-input 2>&1 | tail -n 5
python manage.py collectstatic --noinput -q 2>&1 | tail -n 2
ok "Backend built and migrated"

# ── Step 4: Frontend Build ────────────────────────────────────────────────────
log "⚛️  [4/7] Building Frontend..."
cd "$NEW_RELEASE"

# Reuse shared node_modules
if [ ! -L "$NEW_RELEASE/node_modules" ]; then
    ln -s "$APP_ROOT/node_modules" "$NEW_RELEASE/node_modules"
fi

npm run build 2>&1 | tail -n 5
ok "Frontend built successfully"

# ── Step 5: Pre-flight Health Check ───────────────────────────────────────────
log "🏥 [5/7] Running pre-flight checks..."
cd "$NEW_RELEASE/erp_backend"
source venv/bin/activate
python manage.py check --deploy 2>&1 | tail -n 3
ok "Django system check passed"

# ── Step 6: Atomic Symlink Swap ───────────────────────────────────────────────
log "🔗 [6/7] Performing atomic symlink swap..."
# Save reference to old release for rollback
OLD_RELEASE=$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "none")
log "  Old release: $OLD_RELEASE"
log "  New release: $NEW_RELEASE"

# Atomic swap: create temp link then rename (atomic on Linux)
ln -sfn "$NEW_RELEASE" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
ok "Symlink swapped: $CURRENT_LINK → $NEW_RELEASE"

# ── Step 7: Graceful Service Restart ──────────────────────────────────────────
log "♻️  [7/7] Graceful service restart..."

# Send SIGHUP to Gunicorn for graceful worker reload (zero dropped requests)
GUNICORN_PID=$(pgrep -f 'gunicorn.*core.wsgi' | head -1 || true)
if [[ -n "$GUNICORN_PID" ]]; then
    log "  Sending SIGHUP to Gunicorn (PID: $GUNICORN_PID)..."
    kill -HUP "$GUNICORN_PID"
    ok "Gunicorn workers reloading gracefully"
else
    log "  Gunicorn not found via pgrep, using PM2 restart..."
    pm2 restart django 2>/dev/null || true
fi

# Restart Next.js via PM2
pm2 restart nextjs 2>/dev/null || true
ok "Frontend restarted"

# ── Post-Deploy Health Check with Auto-Rollback ───────────────────────────────
log "🩺 Running post-deploy health check..."
HEALTHY=false
for i in $(seq 1 $HEALTH_TIMEOUT); do
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        HEALTHY=true
        break
    fi
    sleep 1
done

if [[ "$HEALTHY" == true ]]; then
    ok "Health check passed! (HTTP $HTTP_CODE)"
else
    err "Health check FAILED after ${HEALTH_TIMEOUT}s (HTTP $HTTP_CODE)"
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
log "  Health:   HTTP 200"
log "═══════════════════════════════════════════════════"
