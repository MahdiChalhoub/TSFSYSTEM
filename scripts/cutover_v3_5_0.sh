#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# cutover_v3_5_0.sh — One-time tsf.ci cutover to the v3.5.0 migration baseline
#
# RUN THIS ON THE tsf.ci SERVER, ONCE, when shipping v3.5.0.
#
# ARCHITECTURE: tsf.ci runs a hybrid stack:
#   - Backend stack in Docker (tsf_postgres, tsf_backend, tsf_celery, tsf_celery_beat, tsf_redis)
#   - Frontend (nextjs) via pm2 (NOT in Docker)
#
# Why this exists: v3.5.0 regenerated the entire migration tree (432 → 34
# migrations). Running `manage.py migrate` against the existing DB will
# crash because django_migrations references migrations that no longer
# exist as files. The cutover drops and recreates the DB, then applies
# the 34 fresh migrations from empty.
#
# WHAT IT DOES (in order):
#   Phase 1 — ARCHIVE (no destructive ops yet)
#     1. pg_dump the live DB inside tsf_postgres → /root/archives/<TS>.dump
#     2. Snapshot django_migrations table for audit
#     3. tar the live code tree → /root/archives/<TS>.tgz
#   Phase 2 — DEPLOY (only if Phase 1 passed)
#     4. docker compose down (stops + removes old containers, keeps volumes)
#     5. docker compose build (backend + workers with new code)
#     6. docker compose up -d (starts new containers)
#     7. Wait for postgres healthcheck
#     8. Drop + recreate DB inside tsf_postgres
#     9. docker exec tsf_backend python manage.py migrate (clean from empty)
#     10. Frontend rebuild + pm2 restart nextjs
#   Phase 3 — VERIFY
#     11. Health-check frontend (https://tsf.ci) + backend (https://api.tsf.ci/api/auth/config/)
#     12. On failure: print rollback commands referencing the Phase 1 archive
#
# Usage:
#   bash cutover_v3_5_0.sh                  # full cutover
#   bash cutover_v3_5_0.sh --archive-only   # phase 1 only (dry run)
#   bash cutover_v3_5_0.sh --skip-archive   # if already archived (NOT recommended)
#   bash cutover_v3_5_0.sh --auto           # idempotent: skip silently if v3.5.0 already applied
#
# Exit codes: 0 = success, 1 = phase 1 failure (no destructive ops),
#             2 = phase 2 failure (post-archive — see rollback),
#             3 = phase 3 health check failed
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
APP_ROOT="${APP_ROOT:-/root/TSFSYSTEM}"
ARCHIVE_DIR="${ARCHIVE_DIR:-/root/archives}"
DB_CONTAINER="${DB_CONTAINER:-tsf_postgres}"
DB_CONTAINER_LEGACY="${DB_CONTAINER_LEGACY:-tsf_db}"  # pre-Apr-13 container name
BACKEND_CONTAINER="${BACKEND_CONTAINER:-tsf_backend}"
DB_NAME="${DB_NAME:-tsfci_db}"
DB_USER="${DB_USER:-postgres}"
HEALTH_URL_FRONTEND="${HEALTH_URL_FRONTEND:-https://tsf.ci}"
HEALTH_URL_BACKEND="${HEALTH_URL_BACKEND:-https://api.tsf.ci/api/auth/config/}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_FILE:-/var/log/tsf-cutover-v3.5.0-${TIMESTAMP}.log}"

ARCHIVE_ONLY=false
SKIP_ARCHIVE=false
AUTO_SKIP_IF_DONE=false
for arg in "$@"; do
    case "$arg" in
        --archive-only) ARCHIVE_ONLY=true ;;
        --skip-archive) SKIP_ARCHIVE=true ;;
        --auto) AUTO_SKIP_IF_DONE=true ;;
        --help|-h) grep -E "^# " "$0" | head -55; exit 0 ;;
    esac
done

# Detect docker-compose command
DOCKER_COMPOSE="docker-compose"
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
fi

# ── Logging ──────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$LOG_FILE")" "$ARCHIVE_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "═══════════════════════════════════════════════════════════════════════"
echo "  TSF.CI v3.5.0 CUTOVER (Docker) — $(date)"
echo "═══════════════════════════════════════════════════════════════════════"
echo "  APP_ROOT:        $APP_ROOT"
echo "  ARCHIVE_DIR:     $ARCHIVE_DIR"
echo "  DB container:    $DB_CONTAINER (legacy: $DB_CONTAINER_LEGACY)"
echo "  Backend cont.:   $BACKEND_CONTAINER"
echo "  DB:              $DB_NAME (user $DB_USER)"
echo "  LOG:             $LOG_FILE"
echo "  Mode:            ARCHIVE_ONLY=$ARCHIVE_ONLY  SKIP_ARCHIVE=$SKIP_ARCHIVE  AUTO=$AUTO_SKIP_IF_DONE"
echo "═══════════════════════════════════════════════════════════════════════"

# ── Sanity checks ────────────────────────────────────────────────────────────
[ -d "$APP_ROOT" ] || { echo "❌ APP_ROOT $APP_ROOT not found"; exit 1; }
[ -d "$APP_ROOT/erp_backend" ] || { echo "❌ erp_backend not under $APP_ROOT"; exit 1; }
command -v docker >/dev/null || { echo "❌ docker not in PATH"; exit 1; }

# Pick which postgres container is currently running (handles legacy → new rename)
PG_CTR="$DB_CONTAINER"
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER_LEGACY}$"; then
        PG_CTR="$DB_CONTAINER_LEGACY"
        echo "ℹ Legacy postgres container detected: $PG_CTR (will be replaced after cutover)"
    else
        echo "⚠ Neither $DB_CONTAINER nor $DB_CONTAINER_LEGACY is running — Phase 1 archive will be skipped if --auto"
        PG_CTR=""
    fi
fi

# ── Idempotency check ────────────────────────────────────────────────────────
# In --auto mode, detect whether v3.5.0 cutover has already been applied. We
# look in django_migrations for any pre-v3.5 migration name. If none, skip.
if $AUTO_SKIP_IF_DONE; then
    if [ -z "$PG_CTR" ]; then
        echo "ℹ No postgres container running yet — treating as fresh state. Cutover will apply."
    else
        PRE_V3_5=$(docker exec "$PG_CTR" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
            "SELECT count(*) FROM django_migrations WHERE
                (app='finance' AND name LIKE '%payment_gateway_catalog%')
             OR (app='inventory' AND name LIKE '0004_alter_category_barcode_sequence%')
             OR (app='client_portal' AND name LIKE '0009_alter_clientorder_delivery_rating%')" \
            2>/dev/null || echo "ERR")
        if [ "$PRE_V3_5" = "0" ]; then
            echo "✅ v3.5.0 cutover already applied (no pre-v3.5 records in django_migrations). Skipping."
            exit 0
        elif [ "$PRE_V3_5" = "ERR" ]; then
            echo "⚠ Could not query django_migrations (DB may be empty/unreachable). Treating as fresh → cutover applies."
        else
            echo "ℹ Detected $PRE_V3_5 pre-v3.5 migration record(s) — proceeding with cutover."
        fi
    fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# Phase 1 — ARCHIVE (no destructive ops)
# ══════════════════════════════════════════════════════════════════════════════
DB_DUMP=""
CODE_TGZ=""
if ! $SKIP_ARCHIVE; then
    if [ -n "$PG_CTR" ]; then
        echo ""
        echo "── Phase 1.1: Archive DB to $ARCHIVE_DIR ──"
        DB_DUMP="${ARCHIVE_DIR}/tsfci_v3_4_pre_cutover_${TIMESTAMP}.dump"
        docker exec "$PG_CTR" pg_dump -U "$DB_USER" -F c "$DB_NAME" > "$DB_DUMP"
        echo "✅ DB dump: $DB_DUMP ($(du -h "$DB_DUMP" | cut -f1))"

        echo ""
        echo "── Phase 1.2: Snapshot django_migrations (audit trail) ──"
        MIG_AUDIT="${ARCHIVE_DIR}/django_migrations_pre_cutover_${TIMESTAMP}.csv"
        docker exec "$PG_CTR" psql -U "$DB_USER" -d "$DB_NAME" \
            -c "\\COPY (SELECT app, name, applied FROM django_migrations ORDER BY id) TO STDOUT CSV HEADER" \
            > "$MIG_AUDIT" 2>/dev/null || echo "⚠ Could not snapshot migrations table"
        echo "✅ Migration audit: $MIG_AUDIT ($(wc -l < "$MIG_AUDIT" 2>/dev/null || echo 0) rows)"
    else
        echo "⚠ Skipping DB archive — no postgres container running"
    fi

    echo ""
    echo "── Phase 1.3: Archive code tree ──"
    CODE_TGZ="${ARCHIVE_DIR}/code_pre_cutover_${TIMESTAMP}.tgz"
    tar --exclude='node_modules' --exclude='.next' --exclude='__pycache__' \
        --exclude='venv' --exclude='.venv' --exclude='.git' \
        -czf "$CODE_TGZ" -C "$(dirname "$APP_ROOT")" "$(basename "$APP_ROOT")" 2>/dev/null
    echo "✅ Code archive: $CODE_TGZ ($(du -h "$CODE_TGZ" | cut -f1))"

    echo ""
    echo "✅ Phase 1 complete. Archives at $ARCHIVE_DIR/*_${TIMESTAMP}.*"
fi

if $ARCHIVE_ONLY; then
    echo ""
    echo "── --archive-only mode: stopping after Phase 1 ──"
    exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# Phase 2 — DEPLOY
# ══════════════════════════════════════════════════════════════════════════════
trap '
    echo ""
    echo "❌ Phase 2 FAILED. ROLLBACK INSTRUCTIONS:"
    echo "  1. cd $APP_ROOT && docker compose up -d   # restart whatever containers"
    if [ -n "$DB_DUMP" ]; then
        echo "  2. cat $DB_DUMP | docker exec -i $DB_CONTAINER pg_restore -U $DB_USER -d $DB_NAME -c --if-exists"
    fi
    if [ -n "$CODE_TGZ" ]; then
        echo "  3. tar -xzf $CODE_TGZ -C $(dirname "$APP_ROOT")  # if you need to revert code too"
    fi
    exit 2
' ERR

cd "$APP_ROOT"

echo ""
echo "── Phase 2.1: $DOCKER_COMPOSE down (stop + remove old containers) ──"
$DOCKER_COMPOSE down 2>&1 | tail -10

echo ""
echo "── Phase 2.2: $DOCKER_COMPOSE build (with v3.5.0 code) ──"
$DOCKER_COMPOSE build 2>&1 | tail -20

echo ""
echo "── Phase 2.3: $DOCKER_COMPOSE up -d ──"
$DOCKER_COMPOSE up -d 2>&1 | tail -10

echo ""
echo "── Phase 2.4: Wait for postgres healthcheck ──"
for i in $(seq 1 60); do
    if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        echo "✅ postgres ready (after ${i}s)"
        break
    fi
    sleep 1
    [ "$i" = "60" ] && { echo "❌ postgres did not become ready in 60s"; exit 2; }
done

echo ""
echo "── Phase 2.5: Drop + recreate $DB_NAME (the v3.5.0 cutover) ──"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "REVOKE CONNECT ON DATABASE \"$DB_NAME\" FROM public;" 2>/dev/null || true
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
echo "✅ Database recreated empty"

echo ""
echo "── Phase 2.6: Apply 34 fresh v3.5.0 migrations ──"
docker exec "$BACKEND_CONTAINER" python manage.py migrate --no-input 2>&1 | tail -30

echo ""
echo "── Phase 2.7: Seed essentials (idempotent) ──"
docker exec "$BACKEND_CONTAINER" python manage.py seed_kernel_version 2>&1 | tail -3 || echo "⚠ seed_kernel_version missing in v3.5.0 — skipping"
docker exec "$BACKEND_CONTAINER" python manage.py seed_workflows 2>&1 | tail -3 || echo "⚠ seed_workflows missing — skipping"
docker exec "$BACKEND_CONTAINER" python manage.py seed_core 2>&1 | tail -5 || echo "⚠ seed_core missing — skipping"

echo ""
echo "── Phase 2.8: Frontend rebuild + pm2 restart ──"
if [ -f package.json ]; then
    npm install --silent --no-audit --no-fund 2>&1 | tail -3
    npm run build 2>&1 | tail -5
    pm2 restart nextjs 2>&1 | tail -3
    echo "✅ Frontend rebuilt and restarted"
else
    echo "⚠ package.json not found — frontend rebuild skipped"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Phase 3 — VERIFY
# ══════════════════════════════════════════════════════════════════════════════
trap - ERR
sleep 5

echo ""
echo "── Phase 3.1: Health checks ──"
FRONT_HTTP=$(curl -fsSL -o /dev/null -w "%{http_code}" --max-time "$HEALTH_TIMEOUT" "$HEALTH_URL_FRONTEND" || echo "000")
BACK_HTTP=$(curl -fsSL -o /dev/null -w "%{http_code}" --max-time "$HEALTH_TIMEOUT" "$HEALTH_URL_BACKEND" || echo "000")
echo "  Frontend ($HEALTH_URL_FRONTEND): $FRONT_HTTP"
echo "  Backend  ($HEALTH_URL_BACKEND): $BACK_HTTP"

if [[ "$FRONT_HTTP" =~ ^(2|3) ]] && [[ "$BACK_HTTP" =~ ^(2|3) ]]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════"
    echo "  ✅ v3.5.0 CUTOVER COMPLETE"
    echo "═══════════════════════════════════════════════════════════════════════"
    echo "  Frontend: $HEALTH_URL_FRONTEND   ($FRONT_HTTP)"
    echo "  Backend:  $HEALTH_URL_BACKEND   ($BACK_HTTP)"
    echo "  Archives: $ARCHIVE_DIR/*_${TIMESTAMP}.*"
    echo "  Log:      $LOG_FILE"
    echo "═══════════════════════════════════════════════════════════════════════"
    exit 0
else
    echo ""
    echo "❌ Health check failed. Containers up but endpoints not 2xx/3xx."
    echo "   Diagnose:  $DOCKER_COMPOSE logs --tail=50"
    echo "   Rollback:"
    [ -n "$DB_DUMP" ] && echo "     cat $DB_DUMP | docker exec -i $DB_CONTAINER pg_restore -U $DB_USER -d $DB_NAME -c --if-exists"
    [ -n "$CODE_TGZ" ] && echo "     tar -xzf $CODE_TGZ -C $(dirname "$APP_ROOT")"
    echo "     cd $APP_ROOT && $DOCKER_COMPOSE up -d && pm2 restart nextjs"
    exit 3
fi
