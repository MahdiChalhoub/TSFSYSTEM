#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TSFSYSTEM — Git History Purge Script
# ═══════════════════════════════════════════════════════════════
# 
# PURPOSE: Remove heavy historical paths from git history.
#          Run locally on a machine with enough CPU/RAM.
#          DO NOT run on production or resource-limited servers.
#
# PREREQUISITES:
#   pip install git-filter-repo
#
# USAGE:
#   1. Clone a FRESH copy:  git clone <repo-url> tsfsystem-clean
#   2. cd tsfsystem-clean
#   3. Run this script:     bash scripts/ci/purge-history.sh
#   4. Verify:              git count-objects -vH
#   5. Force push:          git push --force --all
#   6. All team members must re-clone after force push
#
# ═══════════════════════════════════════════════════════════════
set -e

echo "═══ TSFSYSTEM History Purge ═══"
echo ""
echo "Pre-purge stats:"
git count-objects -vH
echo ""

# Paths to remove from ALL commits
git filter-repo \
  --path ARCHIVE/ \
  --path restored/ \
  --path .backups/ \
  --path _inventory_mode_src/ \
  --path _quarantine/ \
  --path DOCUMENTATION/ \
  --path certbot/ \
  --path nginx/ \
  --path releases/ \
  --path dist/ \
  --path erp_backend/dist/ \
  --path erp_backend/media/ \
  --path erp_backend/staticfiles/ \
  --path erp_backend/db.sqlite3 \
  --path erp_backend/celerybeat-schedule \
  --path u739151801_dataPOS.sql \
  --path u739151801_dataPOS.pdf \
  --invert-paths \
  --force

echo ""
echo "Post-purge stats:"
git count-objects -vH
echo ""

echo "═══ Purge complete ═══"
echo "Next steps:"
echo "  1. Verify the repo looks correct: git log --oneline -10"
echo "  2. Force push: git push --force --all"
echo "  3. Notify all team members to re-clone"
