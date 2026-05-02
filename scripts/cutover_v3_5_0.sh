#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# cutover_v3_5_0.sh — One-time tsf.ci cutover to the v3.5.0 migration baseline
#
# RUN THIS ON THE tsf.ci SERVER, ONCE, when shipping v3.5.0.
#
# Why this exists: v3.5.0 regenerated the entire migration tree (432 → 34
# migrations). The old `reset_prod_db.sh` and `fix_prod_migrations.sh` reference
# v3.4-era migration numbers that don't exist anymore. This script is the
# v3.5.0-aware replacement.
#
# WHAT IT DOES (in order):
#   Phase 1 — ARCHIVE (no destructive ops yet)
#     1. Stop services
#     2. pg_dump the live DB to /root/archives/tsfci_v3_4_pre_cutover_<TS>.dump
#     3. tar the live code tree to /root/archives/code_pre_cutover_<TS>.tgz
#     4. Save django_migrations row dump for audit
#   Phase 2 — DEPLOY (only if Phase 1 passed)
#     5. Drop + recreate tsfci_db
#     6. Pull origin/main (must include v3.5.0 commit)
#     7. pip install -r requirements.txt (in case deps changed)
#     8. python manage.py migrate (applies 34 clean migrations from empty)
#     9. python manage.py seed_kernel_version + seed_workflows + create_prod_admin
#     10. Start services
#   Phase 3 — VERIFY
#     11. Health-check frontend + backend
#     12. Print rollback instructions if anything fails
#
# Usage:
#   bash cutover_v3_5_0.sh                  # full cutover
#   bash cutover_v3_5_0.sh --archive-only   # phase 1 only (dry run)
#   bash cutover_v3_5_0.sh --skip-archive   # if you already archived (NOT recommended)
#
# Exit codes: 0 = success, 1 = phase 1 failure (no destructive ops ran),
#             2 = phase 2 failure (post-archive, see rollback instructions),
#             3 = phase 3 health check failed
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
APP_ROOT="${APP_ROOT:-/root/TSFSYSTEM}"
ARCHIVE_DIR="${ARCHIVE_DIR:-/root/archives}"
DB_NAME="${DB_NAME:-tsfci_db}"
DB_OWNER="${DB_OWNER:-tsfci}"
DB_PORT="${DB_PORT:-5433}"
HEALTH_URL_FRONTEND="${HEALTH_URL_FRONTEND:-https://tsf.ci}"
HEALTH_URL_BACKEND="${HEALTH_URL_BACKEND:-https://api.tsf.ci/api/auth/config/}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_FILE:-/var/log/tsf-cutover-v3.5.0-${TIMESTAMP}.log}"

ARCHIVE_ONLY=false
SKIP_ARCHIVE=false
AUTO_SKIP_IF_DONE=false  # set by --auto: skip silently if cutover already happened
for arg in "$@"; do
    case "$arg" in
        --archive-only) ARCHIVE_ONLY=true ;;
        --skip-archive) SKIP_ARCHIVE=true ;;
        --auto) AUTO_SKIP_IF_DONE=true ;;
        --help|-h)
            grep -E "^# " "$0" | head -50; exit 0 ;;
    esac
done

# ── Logging ──────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$LOG_FILE")" "$ARCHIVE_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "═══════════════════════════════════════════════════════════════════════"
echo "  TSF.CI v3.5.0 CUTOVER — $(date)"
echo "═══════════════════════════════════════════════════════════════════════"
echo "  APP_ROOT:        $APP_ROOT"
echo "  ARCHIVE_DIR:     $ARCHIVE_DIR"
echo "  DB:              $DB_NAME (port $DB_PORT, owner $DB_OWNER)"
echo "  LOG:             $LOG_FILE"
echo "  Mode:            ARCHIVE_ONLY=$ARCHIVE_ONLY  SKIP_ARCHIVE=$SKIP_ARCHIVE"
echo "═══════════════════════════════════════════════════════════════════════"

# ── Sanity checks ────────────────────────────────────────────────────────────
[ -d "$APP_ROOT" ] || { echo "❌ APP_ROOT $APP_ROOT not found"; exit 1; }
[ -d "$APP_ROOT/erp_backend" ] || { echo "❌ erp_backend not under $APP_ROOT"; exit 1; }
command -v pg_dump >/dev/null || { echo "❌ pg_dump not in PATH"; exit 1; }
command -v pm2 >/dev/null || { echo "⚠ pm2 not in PATH — service control will fail"; }

# ── Idempotency check ────────────────────────────────────────────────────────
# If --auto, detect whether the v3.5.0 cutover has already been applied. We
# look for any pre-v3.5 finance migration in `django_migrations` (those don't
# exist in the post-cutover tree). If none are found, we assume v3.5.0+ and
# skip — letting deploy_atomic.sh continue with its normal `migrate` flow.
if $AUTO_SKIP_IF_DONE; then
    PRE_V3_5_COUNT=$(sudo -u postgres psql -p "$DB_PORT" -d "$DB_NAME" -tAc \
        "SELECT count(*) FROM django_migrations WHERE app='finance' AND name LIKE '%payment_gateway_catalog%' OR app='inventory' AND name LIKE '0004_alter_category_barcode_sequence%' OR app='client_portal' AND name='0002_initial' AND id IN (SELECT id FROM django_migrations WHERE app='client_portal' AND name='0002_initial' LIMIT 1)" \
        2>/dev/null || echo "ERR")
    if [ "$PRE_V3_5_COUNT" = "0" ]; then
        echo "✅ v3.5.0 cutover already applied (no pre-v3.5 migrations in django_migrations). Skipping."
        exit 0
    fi
    if [ "$PRE_V3_5_COUNT" = "ERR" ]; then
        echo "⚠ Could not query django_migrations (DB may be empty or unreachable). Treating as fresh DB → cutover applies."
    else
        echo "ℹ Detected $PRE_V3_5_COUNT pre-v3.5 migration record(s) — proceeding with cutover."
    fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# Phase 1 — ARCHIVE (no destructive ops)
# ══════════════════════════════════════════════════════════════════════════════
if ! $SKIP_ARCHIVE; then
    echo ""
    echo "── Phase 1.1: Stop services ──"
    pm2 stop all || echo "⚠ pm2 stop failed (may be ok if services weren't running)"
    sleep 2

    echo ""
    echo "── Phase 1.2: Archive DB to $ARCHIVE_DIR ──"
    DB_DUMP="${ARCHIVE_DIR}/tsfci_v3_4_pre_cutover_${TIMESTAMP}.dump"
    sudo -u postgres pg_dump -p "$DB_PORT" -F c "$DB_NAME" -f "$DB_DUMP"
    DB_DUMP_SIZE=$(du -h "$DB_DUMP" | cut -f1)
    echo "✅ DB dump: $DB_DUMP ($DB_DUMP_SIZE)"

    echo ""
    echo "── Phase 1.3: Archive code tree ──"
    CODE_TGZ="${ARCHIVE_DIR}/code_pre_cutover_${TIMESTAMP}.tgz"
    tar --exclude='node_modules' --exclude='.next' --exclude='__pycache__' \
        --exclude='venv' --exclude='.venv' \
        -czf "$CODE_TGZ" -C "$(dirname "$APP_ROOT")" "$(basename "$APP_ROOT")"
    CODE_TGZ_SIZE=$(du -h "$CODE_TGZ" | cut -f1)
    echo "✅ Code archive: $CODE_TGZ ($CODE_TGZ_SIZE)"

    echo ""
    echo "── Phase 1.4: Snapshot migration record (audit trail) ──"
    MIG_AUDIT="${ARCHIVE_DIR}/django_migrations_pre_cutover_${TIMESTAMP}.csv"
    sudo -u postgres psql -p "$DB_PORT" -d "$DB_NAME" \
        -c "\\COPY (SELECT app, name, applied FROM django_migrations ORDER BY id) TO STDOUT CSV HEADER" \
        > "$MIG_AUDIT"
    echo "✅ Migration audit: $MIG_AUDIT ($(wc -l < "$MIG_AUDIT") rows)"

    echo ""
    echo "✅ Phase 1 complete. Archives are safe at $ARCHIVE_DIR/*_${TIMESTAMP}.*"
fi

if $ARCHIVE_ONLY; then
    echo ""
    echo "── --archive-only mode: stopping after Phase 1 ──"
    echo "Restart services manually with: pm2 start all"
    exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# Phase 2 — DEPLOY
# ══════════════════════════════════════════════════════════════════════════════
trap 'echo ""; echo "❌ Phase 2 FAILED. ROLLBACK INSTRUCTIONS:"; echo "  1. sudo -u postgres pg_restore -p $DB_PORT -d $DB_NAME -c \"$DB_DUMP\""; echo "  2. tar -xzf \"$CODE_TGZ\" -C $(dirname "$APP_ROOT")"; echo "  3. pm2 start all"; exit 2' ERR

echo ""
echo "── Phase 2.1: Drop + recreate $DB_NAME ──"
sudo -u postgres psql -p "$DB_PORT" -c "REVOKE CONNECT ON DATABASE $DB_NAME FROM public;" || true
sudo -u postgres psql -p "$DB_PORT" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" || true
sudo -u postgres psql -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $DB_NAME;"
sudo -u postgres psql -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME OWNER $DB_OWNER;"
echo "✅ Database recreated empty"

echo ""
echo "── Phase 2.2: Pull origin/main ──"
cd "$APP_ROOT"
git fetch origin
LOCAL_HEAD=$(git rev-parse HEAD)
git checkout main
git pull --ff-only origin main
NEW_HEAD=$(git rev-parse HEAD)
echo "Code updated: $LOCAL_HEAD → $NEW_HEAD"

# Verify v3.5.0 tag is reachable from current commit
if ! git merge-base --is-ancestor v3.5.0 HEAD; then
    echo "❌ Current HEAD does not include the v3.5.0 tag. Did the push complete?"
    exit 2
fi
echo "✅ HEAD includes v3.5.0 tag"

echo ""
echo "── Phase 2.3: pip install (in case deps changed) ──"
cd "$APP_ROOT/erp_backend"
source venv/bin/activate
pip install -q -r requirements.txt 2>&1 | tail -5

echo ""
echo "── Phase 2.4: python manage.py migrate ──"
python manage.py migrate --no-input

echo ""
echo "── Phase 2.5: Seed essential data ──"
python manage.py seed_kernel_version 2>&1 | tail -3 || echo "⚠ seed_kernel_version failed (may not exist in v3.5.0)"
python manage.py seed_workflows 2>&1 | tail -3 || echo "⚠ seed_workflows failed (may not exist)"
# create_prod_admin is idempotent — safe to re-run
python scripts/create_prod_admin.py 2>&1 | tail -3 || echo "⚠ create_prod_admin failed (manual creation may be needed)"

echo ""
echo "── Phase 2.6: Frontend build (if needed) ──"
cd "$APP_ROOT"
if [ -f package.json ]; then
    npm ci --silent 2>&1 | tail -3 || echo "⚠ npm ci failed"
    npm run build 2>&1 | tail -10 || echo "⚠ npm build failed"
fi

echo ""
echo "── Phase 2.7: Start services ──"
pm2 start all
sleep 5
pm2 status

# ══════════════════════════════════════════════════════════════════════════════
# Phase 3 — VERIFY
# ══════════════════════════════════════════════════════════════════════════════
trap - ERR  # Phase 3 failures don't trigger the Phase 2 rollback message
echo ""
echo "── Phase 3.1: Health check ──"
sleep 5  # give services a moment to come up

FRONT_HTTP=$(curl -fsSL -o /dev/null -w "%{http_code}" --max-time "$HEALTH_TIMEOUT" "$HEALTH_URL_FRONTEND" || echo "000")
BACK_HTTP=$(curl -fsSL -o /dev/null -w "%{http_code}" --max-time "$HEALTH_TIMEOUT" "$HEALTH_URL_BACKEND" || echo "000")
echo "  Frontend ($HEALTH_URL_FRONTEND):  $FRONT_HTTP"
echo "  Backend  ($HEALTH_URL_BACKEND):  $BACK_HTTP"

if [[ "$FRONT_HTTP" =~ ^2|3 ]] && [[ "$BACK_HTTP" =~ ^2|3 ]]; then
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
    echo "❌ Health check FAILED. Services started but endpoints not responding."
    echo "   Investigate logs: pm2 logs"
    echo "   Or rollback:"
    echo "     sudo -u postgres pg_restore -p $DB_PORT -d $DB_NAME -c \"$DB_DUMP\""
    echo "     tar -xzf \"$CODE_TGZ\" -C $(dirname "$APP_ROOT")"
    echo "     pm2 restart all"
    exit 3
fi
