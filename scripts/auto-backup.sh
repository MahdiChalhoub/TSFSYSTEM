#!/usr/bin/env bash
# ============================================================
# TSFSYSTEM — Automatic Git Backup
# Runs every 30 minutes via crontab.
# Each run creates a NEW timestamped commit — never overwrites.
# ============================================================

set -euo pipefail

REPO="/root/.gemini/antigravity/scratch/TSFSYSTEM"
LOG="/var/log/tsf-backup.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SHORT_TS=$(date '+%Y%m%d-%H%M%S')

log() {
    echo "[${TIMESTAMP}] $*" | tee -a "$LOG"
}

cd "$REPO" || { log "ERROR: Cannot cd to $REPO"; exit 1; }

# ── Check for changes ──────────────────────────────────────
# Stage everything (new files, modifications, deletions)
git add -A

# If nothing changed, skip silently
if git diff --cached --quiet; then
    log "SKIP: No changes since last backup."
    exit 0
fi

# ── Collect stats for commit message ──────────────────────
CHANGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
STAT=$(git diff --cached --stat | tail -1 | sed 's/^[[:space:]]*//')

# ── Commit with timestamp ─────────────────────────────────
git -c user.name="TSF Agent" \
    -c user.email="agent@tsfsystem.local" \
    commit -m "[auto-backup] ${TIMESTAMP} — ${STAT}"

HASH=$(git rev-parse --short HEAD)
log "OK: Committed ${CHANGED} file(s) as ${HASH}. ${STAT}"

# ── Push to origin/main ───────────────────────────────────
# Push after every successful commit so GitHub stays in sync with
# the local auto-backup stream. If the remote is unreachable we log
# and continue — a failed push must never block future backups.
if git push --quiet origin HEAD:main 2>>"$LOG"; then
    log "PUSH: ${HASH} → origin/main"
else
    log "PUSH FAIL: ${HASH} stayed local; will retry on next run."
fi

# ── Health check: restart frontend if stuck ───────────────
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1:3000/ 2>/dev/null || echo "000")
if [[ "$FRONTEND_STATUS" == "000" || "$FRONTEND_STATUS" == "502" || "$FRONTEND_STATUS" == "504" ]]; then
    log "HEALTH: Frontend unresponsive (HTTP ${FRONTEND_STATUS}) — restarting container..."
    docker restart tsfsystem-frontend-1 >> "$LOG" 2>&1 && log "HEALTH: Container restarted." || log "HEALTH: Restart failed."
elif docker stats tsfsystem-frontend-1 --no-stream --format "{{.MemPerc}}" 2>/dev/null | awk -F'%' '$1+0 > 85 {exit 1}'; then
    :  # memory OK
else
    log "HEALTH: Frontend memory >85% — restarting container to free memory..."
    docker restart tsfsystem-frontend-1 >> "$LOG" 2>&1 && log "HEALTH: Container restarted." || log "HEALTH: Restart failed."
fi
