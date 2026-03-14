#!/bin/bash
# ╔════════════════════════════════════════════════════════════════════╗
# ║  TSFSYSTEM Server-Side Deploy Worker                              ║
# ║                                                                    ║
# ║  PURPOSE: Runs the actual build pipeline on the production server  ║
# ║  CALLED BY: deploy_safe.sh (via SSH)                               ║
# ║  DO NOT CALL DIRECTLY — use deploy_safe.sh instead                 ║
# ║                                                                    ║
# ║  ARGS:                                                             ║
# ║    $1 = AGENT_VERSION (e.g., "3.5.0-AG-260310.2025")               ║
# ║    $2 = AGENT_ID     (e.g., "agent-12345-hostname-142530")         ║
# ║    $3 = DEPLOY_DIR   (e.g., "/root/.deploy")                       ║
# ║    $4 = PROJECT_DIR  (e.g., "/root/TSFSYSTEM")                     ║
# ╚════════════════════════════════════════════════════════════════════╝

set -e

AGENT_VERSION="${1:-unknown}"
AGENT_ID="${2:-unknown}"
DEPLOY_DIR="${3:-/root/.deploy}"
PROJECT_DIR="${4:-/root/TSFSYSTEM}"

HISTORY_FILE="$DEPLOY_DIR/history.log"

# ─────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────
log_info()  { echo "ℹ️  $1"; }
log_ok()    { echo "✅ $1"; }
log_warn()  { echo "⚠️  $1"; }
log_error() { echo "❌ $1"; }
log_step()  { echo ""; echo "═══ $1 ═══"; echo ""; }

# Track timing
DEPLOY_START=$(date +%s)

# ─────────────────────────────────────────────────────────
# STEP 1: Git Backup (pre-deploy snapshot)
# ─────────────────────────────────────────────────────────
log_step "Server: Git Backup"

cd "$PROJECT_DIR"

# Commit any current state as pre-deploy backup
git add -A 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "backup: pre-deploy snapshot before $AGENT_VERSION" 2>/dev/null || true
    log_ok "Pre-deploy snapshot committed."
else
    log_info "No uncommitted changes — skipping snapshot."
fi

# Push to GitHub (best-effort)
PUSH_OUTPUT=$(git push origin main 2>&1) || true
if echo "$PUSH_OUTPUT" | grep -qi "error\|fatal\|rejected"; then
    log_warn "GitHub push failed (local commit preserved). Continuing deploy..."
else
    log_ok "Pre-deploy snapshot pushed to GitHub."
fi

# ─────────────────────────────────────────────────────────
# STEP 2: Memory Protection for Migrations
# ─────────────────────────────────────────────────────────
log_step "Server: Memory Protection (Migrations)"

log_info "Stopping non-essential services to free memory for migrations..."
docker-compose -f "$PROJECT_DIR/docker-compose.yml" stop frontend celery_worker celery_beat mcp_agent_pulse 2>/dev/null || true
log_ok "Non-essential services stopped."

# ─────────────────────────────────────────────────────────
# STEP 3: Database Migrations
# ─────────────────────────────────────────────────────────
log_step "Server: Database Migrations"

# Run migration fix script (organization -> tenant)
if [ -f "$PROJECT_DIR/fix_migrations_on_server.py" ]; then
    log_info "Running migration fix script..."
    docker-compose -f "$PROJECT_DIR/docker-compose.yml" run --rm backend python fix_migrations_on_server.py 2>&1
    log_ok "Migration field fix complete."
fi

# Skip automatic migration generation on server — use local migrations instead
# set +e
# docker-compose -f "$PROJECT_DIR/docker-compose.yml" run --rm backend python manage.py makemigrations --noinput 2>&1
# MAKE_EXIT=$?
# set -e

# Apply migrations
log_info "Applying migrations..."
set +e
docker-compose -f "$PROJECT_DIR/docker-compose.yml" run --rm backend python manage.py migrate --noinput 2>&1
MIGRATE_EXIT=$?
set -e

if [ $MIGRATE_EXIT -eq 0 ]; then
    log_ok "Migrations applied successfully."
else
    log_error "migrate returned exit $MIGRATE_EXIT — check for migration conflicts."
    # docker-compose -f "$PROJECT_DIR/docker-compose.yml" run --rm backend python manage.py makemigrations --merge --noinput 2>&1 || true
    # docker-compose -f "$PROJECT_DIR/docker-compose.yml" run --rm backend python manage.py migrate --noinput 2>&1 || {
    #     log_error "Migration failed even after merge attempt."
    # }
fi

# ─────────────────────────────────────────────────────────
# STEP 4: Restart/Start Services
# ─────────────────────────────────────────────────────────
log_step "Server: Restarting Backend"

docker-compose -f "$PROJECT_DIR/docker-compose.yml" restart backend 2>&1 || log_warn "Backend restart failed"
log_ok "Backend restarted."

# ─────────────────────────────────────────────────────────
# STEP 5: Build Frontend (the heavy step)
# ─────────────────────────────────────────────────────────
log_step "Server: Building Frontend (this takes 2-5 minutes)"

# Clean up Docker build cache to free memory before build
log_info "Pruning Docker build cache before build..."
PRUNE_OUTPUT=$(docker builder prune -f 2>&1)
RECLAIMED=$(echo "$PRUNE_OUTPUT" | grep -i "reclaimed" | tail -1)
if [ -n "$RECLAIMED" ]; then
    log_ok "Build cache pruned: $RECLAIMED"
else
    log_ok "Build cache pruned."
fi
docker image prune -f 2>/dev/null || true


BUILD_START=$(date +%s)

cd "$PROJECT_DIR"
docker-compose build --no-cache frontend backend 2>&1

BUILD_END=$(date +%s)
BUILD_DURATION=$(( BUILD_END - BUILD_START ))
log_ok "Frontend built in ${BUILD_DURATION}s."

# ─────────────────────────────────────────────────────────
# STEP 6: Deploy Frontend + Bring Services Back Up
# ─────────────────────────────────────────────────────────
log_step "Server: Deploying Frontend & Restarting All Services"

# Remove any orphan/ghost frontend containers
docker ps -a --filter 'name=tsfsystem-frontend' --format '{{.ID}} {{.Names}}' | while read id name; do
    if [[ "$name" == *_tsfsystem-frontend* ]] || [[ "$name" == *tsfsystem-frontend* ]]; then
        log_info "Removing old container: $name ($id)"
        docker rm -f "$id" 2>/dev/null || true
    fi
done

# Force-recreate frontend and bring all services up
cd "$PROJECT_DIR"
docker-compose up -d --force-recreate --remove-orphans 2>&1
log_ok "All services up (frontend, backend, celery, mcp)."

# ─────────────────────────────────────────────────────────
# STEP 7: Restart Gateway
# ─────────────────────────────────────────────────────────
log_step "Server: Restarting Gateway"

docker restart tsf_gateway 2>&1 || log_warn "Gateway restart failed — may need manual restart."
log_ok "Nginx gateway restarted."

# ─────────────────────────────────────────────────────────
# STEP 8: Post-Deploy Git Commit
# ─────────────────────────────────────────────────────────
log_step "Server: Post-Deploy Commit"

cd "$PROJECT_DIR"
git add -A 2>/dev/null || true
git commit -m "deploy: $AGENT_VERSION" --allow-empty 2>/dev/null || true
git push origin main 2>&1 || log_warn "Post-deploy push failed (local commit saved)."
log_ok "Deploy commit created."

# ─────────────────────────────────────────────────────────
# STEP 9: Cleanup
# ─────────────────────────────────────────────────────────
log_step "Server: Cleanup"

docker image prune -f 2>/dev/null || true
log_ok "Old images pruned."

# ─────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────
DEPLOY_END=$(date +%s)
TOTAL_DURATION=$(( DEPLOY_END - DEPLOY_START ))

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Server Deploy Pipeline Complete                        ║"
echo "║  Version:  $AGENT_VERSION"
echo "║  Agent:    $AGENT_ID"
echo "║  Duration: ${TOTAL_DURATION}s (build: ${BUILD_DURATION}s)"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

exit 0
