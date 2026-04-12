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
