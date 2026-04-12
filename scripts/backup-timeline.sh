#!/usr/bin/env bash
# ============================================================
# TSFSYSTEM — Backup Timeline Viewer
# Usage:
#   ./backup-timeline.sh          — show last 20 backups
#   ./backup-timeline.sh 50       — show last N backups
#   ./backup-timeline.sh restore  — interactive restore picker
# ============================================================

REPO="/root/.gemini/antigravity/scratch/TSFSYSTEM"
cd "$REPO" || { echo "ERROR: Cannot cd to $REPO"; exit 1; }

MODE="${1:-list}"
LIMIT="${1:-20}"

# If first arg is a number, it's the limit
if [[ "$1" =~ ^[0-9]+$ ]]; then
    MODE="list"
    LIMIT="$1"
fi

# ── Colors ─────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
DIM="\033[2m"
RESET="\033[0m"

if [[ "$MODE" == "list" || "$MODE" =~ ^[0-9]+$ ]]; then
    echo ""
    echo -e "${BOLD}  TSFSYSTEM — Backup Timeline${RESET}"
    echo -e "${DIM}  $(git rev-parse --abbrev-ref HEAD) branch · auto-backups only${RESET}"
    echo ""
    echo -e "${DIM}  HASH     TIME                 FILES  SUMMARY${RESET}"
    echo -e "${DIM}  ────     ────────────────────  ─────  ───────────────────────────────${RESET}"

    git log \
        --grep="\[auto-backup\]" \
        --format="%h|%ai|%s" \
        -n "$LIMIT" | \
    while IFS='|' read -r hash datetime subject; do
        # Extract timestamp from subject (between [auto-backup] and —)
        ts=$(echo "$subject" | sed 's/\[auto-backup\] //' | sed 's/ —.*//')
        # Extract stat from subject (after —)
        stat=$(echo "$subject" | sed 's/.*— //')
        # Count files changed from stat
        files=$(echo "$stat" | grep -oE '^[0-9]+' || echo "?")

        printf "  ${CYAN}%-8s${RESET} ${GREEN}%-20s${RESET} ${YELLOW}%5s${RESET}  ${DIM}%s${RESET}\n" \
            "$hash" "$ts" "$files" "$stat"
    done

    echo ""
    TOTAL=$(git log --grep="\[auto-backup\]" --oneline | wc -l | tr -d ' ')
    echo -e "${DIM}  Total backup commits: ${BOLD}${TOTAL}${RESET}"
    echo ""
    echo -e "  ${DIM}To restore a backup:${RESET}"
    echo -e "  ${CYAN}git checkout <hash> -- .${RESET}   ${DIM}(restore files without switching branch)${RESET}"
    echo -e "  ${CYAN}git diff <hash>       ${RESET}   ${DIM}(see what changed since that backup)${RESET}"
    echo ""

elif [[ "$MODE" == "restore" ]]; then
    echo ""
    echo -e "${BOLD}  Backup Restore — Pick a checkpoint:${RESET}"
    echo ""

    # Build numbered list
    mapfile -t HASHES < <(git log --grep="\[auto-backup\]" --format="%h" -n 30)
    mapfile -t SUBJECTS < <(git log --grep="\[auto-backup\]" --format="%ai — %s" -n 30)

    for i in "${!HASHES[@]}"; do
        printf "  ${CYAN}[%2d]${RESET} %s  ${DIM}(%s)${RESET}\n" \
            "$((i+1))" "${SUBJECTS[$i]}" "${HASHES[$i]}"
    done

    echo ""
    read -rp "  Enter number to restore (0 to cancel): " CHOICE

    if [[ "$CHOICE" == "0" || -z "$CHOICE" ]]; then
        echo "  Cancelled."
        exit 0
    fi

    IDX=$((CHOICE - 1))
    SELECTED="${HASHES[$IDX]}"

    if [[ -z "$SELECTED" ]]; then
        echo "  Invalid selection."
        exit 1
    fi

    echo ""
    echo -e "  ${YELLOW}About to restore files from backup ${SELECTED}${RESET}"
    echo -e "  ${DIM}This will overwrite your working tree but keep git history.${RESET}"
    read -rp "  Confirm? [y/N] " CONFIRM

    if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
        # First, stash current changes to be safe
        git stash push -m "pre-restore stash $(date '+%Y-%m-%d %H:%M:%S')" || true
        # Restore file state from the selected commit
        git checkout "$SELECTED" -- .
        echo ""
        echo -e "  ${GREEN}Restored to backup ${SELECTED}.${RESET}"
        echo -e "  ${DIM}Your previous state is saved in git stash. Run 'git stash list' to see it.${RESET}"
    else
        echo "  Cancelled."
    fi
fi
