#!/bin/bash
# ─────────────────────────────────────────────────────────────
# quick_sync.sh — Push backend changes to developos.shop FAST
# Syncs Python files + restarts Django. ~10 seconds.
# For frontend changes, use ./deploy_safe.sh (full rebuild).
# ─────────────────────────────────────────────────────────────
set -e

SERVER="root@91.99.11.249"
KEY="$HOME/.ssh/id_deploy"
REMOTE_DIR="/root/TSFSYSTEM"

echo "⚡ Quick-syncing backend to developos.shop..."

# Sync only backend Python files (fast)
rsync -avz --update \
  -e "ssh -i $KEY -o StrictHostKeyChecking=no" \
  erp_backend/ \
  "$SERVER:$REMOTE_DIR/erp_backend/"

echo "🔄 Restarting backend container..."
ssh -i "$KEY" "$SERVER" "cd $REMOTE_DIR && docker compose restart backend"

echo ""
echo "✅ Backend synced & restarted on developos.shop!"
echo "   Frontend unchanged — run ./deploy_safe.sh for frontend changes."
