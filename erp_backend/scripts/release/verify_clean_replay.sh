#!/usr/bin/env bash
# verify_clean_replay.sh — drop a scratch DB, recreate, run all migrations, assert clean.
#
# This is the gatekeeper for the migration release pipeline. Run before any
# release cut. Run in CI on every PR that touches migrations/.
#
# Exit 0 = the migration tree replays cleanly from zero. Safe to release.
# Non-zero = drift detected. Fix before merging.
#
# Usage:
#   bash scripts/release/verify_clean_replay.sh
#
# Requires:
#   - PGPASSWORD set (or DB_PASSWORD env var)
#   - Postgres running on localhost:5432
#   - User `postgres` with createdb privilege
#   - Run from erp_backend/ directory (settings.py path)
#
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
TEST_DB="${TEST_DB:-tsfdb_replay_test_$$}"
PG_HOST="${DB_HOST:-localhost}"
PG_USER="${DB_USER:-postgres}"
PG_PASSWORD="${DB_PASSWORD:-${PGPASSWORD:-postgres}}"

export PGPASSWORD="$PG_PASSWORD"

# ── Cleanup on exit ─────────────────────────────────────────────────
cleanup() {
    local exit_code=$?
    echo ""
    echo "── Cleanup ──"
    dropdb -h "$PG_HOST" -U "$PG_USER" "$TEST_DB" --if-exists 2>/dev/null || true
    exit $exit_code
}
trap cleanup EXIT

# ── 1. Drop & recreate scratch DB ───────────────────────────────────
echo "── 1. Drop & recreate $TEST_DB on $PG_HOST ──"
dropdb -h "$PG_HOST" -U "$PG_USER" "$TEST_DB" --if-exists
createdb -h "$PG_HOST" -U "$PG_USER" "$TEST_DB"

# ── 2. Run migrations against scratch DB ────────────────────────────
echo ""
echo "── 2. Run all migrations from empty ──"
DB_NAME="$TEST_DB" python3 manage.py migrate --no-input

# ── 3. System check ─────────────────────────────────────────────────
echo ""
echo "── 3. manage.py check ──"
DB_NAME="$TEST_DB" python3 manage.py check

# ── 4. Drift check (model state must match migration state) ─────────
echo ""
echo "── 4. manage.py makemigrations --dry-run ──"
output=$(DB_NAME="$TEST_DB" python3 manage.py makemigrations --dry-run 2>&1)
echo "$output"
if echo "$output" | grep -qE "No changes detected"; then
    echo "✅ No drift between models and migrations."
else
    echo ""
    echo "❌ DRIFT DETECTED — models do not match the migration state."
    echo "   Run \`python3 manage.py makemigrations\` to generate the missing migration,"
    echo "   then re-run this script."
    exit 1
fi

echo ""
echo "✅ Clean replay verified."
echo "   The migration tree replays cleanly from zero. Safe to release."
