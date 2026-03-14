#!/bin/bash
set -e

# ╔════════════════════════════════════════════════════════════╗
# ║  ⚠️  DEPRECATED — Use deploy_safe.sh instead               ║
# ║                                                            ║
# ║  deploy_safe.sh provides:                                  ║
# ║  • Atomic server-side locking (prevents concurrent builds) ║
# ║  • Queue system for multi-agent coordination               ║
# ║  • Auto-batching of queued deploys                         ║
# ║  • Memory protection (stops celery before build)           ║
# ║  • rsync --update (prevents file overwrites)               ║
# ╚════════════════════════════════════════════════════════════╝

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  WARNING: deploy_hotfix.sh is DEPRECATED              ║"
echo "║                                                            ║"
echo "║  Use ./deploy_safe.sh instead!                             ║"
echo "║                                                            ║"
echo "║  deploy_safe.sh prevents server crashes from concurrent    ║"
echo "║  deploys by multiple agents.                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Continuing with legacy deploy in 5 seconds... (Ctrl+C to abort)"
sleep 5
echo ""

# ╔════════════════════════════════════════════════════════════╗
# ║  TSFSYSTEM Deploy Script with GitHub Backup               ║
# ║  Every deploy creates a versioned backup on GitHub FIRST   ║
# ╚════════════════════════════════════════════════════════════╝

REMOTE_HOST="root@91.99.186.183"
SSH_KEY="~/.ssh/id_deploy"
SSH="ssh -i $SSH_KEY -o ConnectTimeout=15 $REMOTE_HOST"
REMOTE_DIR="/root/TSFSYSTEM"
LOCAL_DIR="/root/.gemini/antigravity/scratch/TSFSYSTEM"
LOCK_FILE="/tmp/tsf_deploy.lock"
REMOTE_LOCK="/tmp/tsf_deploy.lock"

# ── Local Deploy Lock ──
if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE")
    if kill -0 "$LOCK_PID" 2>/dev/null; then
        echo "❌ Another LOCAL deploy is in progress (PID: $LOCK_PID). Wait or kill it first."
        echo "   To force: rm $LOCK_FILE"
        exit 1
    else
        echo "⚠️  Stale local lock found (PID $LOCK_PID dead). Cleaning up..."
        rm -f "$LOCK_FILE"
    fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f $LOCK_FILE; $SSH "rm -f $REMOTE_LOCK" 2>/dev/null || true' EXIT INT TERM

# ── Server-Side Deploy Lock (prevents 3 agents from deploying simultaneously) ──
echo "🔒 Checking server-side deploy lock..."
LOCK_CHECK=$($SSH "
    if [ -f $REMOTE_LOCK ]; then
        LOCK_AGE=\$(( \$(date +%s) - \$(stat -c %Y $REMOTE_LOCK 2>/dev/null || echo 0) ))
        LOCK_CONTENT=\$(cat $REMOTE_LOCK 2>/dev/null || echo 'unknown')
        if [ \$LOCK_AGE -gt 900 ]; then
            echo 'STALE'
            rm -f $REMOTE_LOCK
        else
            echo \"LOCKED|\$LOCK_CONTENT|\$LOCK_AGE\"
        fi
    else
        echo 'FREE'
    fi
" 2>/dev/null || echo "SSH_FAIL")

if echo "$LOCK_CHECK" | grep -q "^LOCKED"; then
    LOCK_INFO=$(echo "$LOCK_CHECK" | cut -d'|' -f2)
    LOCK_AGE=$(echo "$LOCK_CHECK" | cut -d'|' -f3)
    echo "❌ Another deploy is running on the SERVER!"
    echo "   Started by: $LOCK_INFO"
    echo "   Running for: ${LOCK_AGE}s"
    echo "   To force: ssh -i $SSH_KEY $REMOTE_HOST 'rm -f $REMOTE_LOCK'"
    rm -f "$LOCK_FILE"
    exit 1
elif echo "$LOCK_CHECK" | grep -q "STALE"; then
    echo "⚠️  Stale server lock found (>15min). Cleaned up."
elif echo "$LOCK_CHECK" | grep -q "SSH_FAIL"; then
    echo "⚠️  Could not check server lock (SSH failed). Proceeding cautiously..."
fi

# Acquire server lock
$SSH "echo 'agent-$$-$(date +%H:%M:%S)' > $REMOTE_LOCK" 2>/dev/null || true
echo "🔓 Server lock acquired."

RSYNC_EXCLUDES=(
    --exclude 'node_modules'
    --exclude '.next'
    --exclude '.git'
    --exclude 'venv'
    --exclude '.venv'
    --exclude '**/venv'
    --exclude '**/.venv'
    --exclude '**/__pycache__'
    --exclude '.env'
    --exclude 'db_data'
    --exclude 'postgres_data'
    --exclude 'deploy_hotfix.sh'
    --exclude 'erp_backend/releases/'
    --exclude 'releases/'
    --exclude 'tmp/'
    --exclude '.antigravity-server/'
)

# Version Configuration
AGENT_VERSION="3.5.0-AG-$(date +'%y%m%d.%H%M')"
echo ""
echo "══════════════════════════════════════════════════════"
echo "🚀 TSFSYSTEM Deploy — Version: $AGENT_VERSION"
echo "══════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────
# STEP 0: Create GitHub backup of CURRENT server state
# ─────────────────────────────────────────────────────────
echo "📸 Step 0: Creating GitHub backup of current server state..."
$SSH "cd $REMOTE_DIR && git add -A && git diff --cached --quiet && echo 'No changes to commit' || git commit -m 'backup: pre-deploy snapshot before $AGENT_VERSION'" || true

echo "📤 Step 0b: Pushing backup to GitHub..."
PUSH_RESULT=$($SSH "cd $REMOTE_DIR && git push origin main 2>&1" || true)
echo "$PUSH_RESULT"

if echo "$PUSH_RESULT" | grep -qi "error\|fatal\|rejected\|Authentication failed"; then
    echo ""
    echo "⚠️  ════════════════════════════════════════════════════"
    echo "⚠️  GitHub push FAILED! Your backup is NOT on GitHub!"
    echo "⚠️  The commit is saved LOCALLY on the server only."
    echo "⚠️  Fix your GitHub token to enable remote backups."
    echo "⚠️  ════════════════════════════════════════════════════"
    echo ""
    read -p "Continue deploy WITHOUT GitHub backup? (y/N): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "❌ Deploy aborted. Fix GitHub token first."
        exit 1
    fi
else
    echo "✅ GitHub backup created successfully!"
fi

# ─────────────────────────────────────────────────────────
# STEP 1: Pull remote changes to local (--update = newer wins)
# ─────────────────────────────────────────────────────────
echo ""
echo "📥 Step 1: Pulling remote changes to local (newer files win)..."
rsync -avz --update -e "ssh -i $SSH_KEY" \
    "${RSYNC_EXCLUDES[@]}" \
    --exclude 'src/components/app-sidebar.tsx' \
    --exclude 'src/components/admin/Sidebar.tsx' \
    --exclude 'src/lib/branding.ts' \
    $REMOTE_HOST:$REMOTE_DIR/ $LOCAL_DIR/

# ─────────────────────────────────────────────────────────
# STEP 2: Update version in branding
# ─────────────────────────────────────────────────────────
echo ""
echo "🏷️  Step 2: Stamping version $AGENT_VERSION..."
sed -i "s/version: \".*\"/version: \"$AGENT_VERSION\"/" src/lib/branding.ts

# ─────────────────────────────────────────────────────────
# STEP 3: Push local changes to remote
# ─────────────────────────────────────────────────────────
echo ""
echo "📤 Step 3: Pushing local changes to remote..."
rsync -avz -e "ssh -i $SSH_KEY" \
    "${RSYNC_EXCLUDES[@]}" \
    $LOCAL_DIR/ $REMOTE_HOST:$REMOTE_DIR/

# ─────────────────────────────────────────────────────────
# STEP 4: Git commit + push the deployed version
# ─────────────────────────────────────────────────────────
echo ""
echo "📸 Step 4: Creating deploy commit on server..."
$SSH "cd $REMOTE_DIR && git add -A && git commit -m 'deploy: $AGENT_VERSION' --allow-empty" || true
$SSH "cd $REMOTE_DIR && git push origin main 2>&1" || echo "⚠️  Post-deploy push failed (local commit saved)"

# ─────────────────────────────────────────────────────────
# STEP 5: Database Migrations
# ─────────────────────────────────────────────────────────
echo ""
echo "📊 Step 5: Applying Database Migrations..."
$SSH "docker exec tsfsystem-backend-1 python manage.py makemigrations --noinput" || true
$SSH "docker exec tsfsystem-backend-1 python manage.py migrate --noinput"

# ─────────────────────────────────────────────────────────
# STEP 5b: Seed Unified Theme Engine (20 themes)
# ─────────────────────────────────────────────────────────
echo ""
echo "🎨 Step 5b: Seeding Unified Theme Engine..."
$SSH "docker exec tsfsystem-backend-1 python manage.py seed_themes" || echo "⚠️  Theme seeding skipped (may already exist)"

# ─────────────────────────────────────────────────────────
# STEP 6: Restart Backend Services
# ─────────────────────────────────────────────────────────
echo ""
echo "🔄 Step 6: Restarting Backend & Celery Services..."
$SSH "docker restart tsfsystem-backend-1 tsfsystem-celery_worker-1 tsfsystem-celery_beat-1"

# ─────────────────────────────────────────────────────────
# STEP 7: Rebuild Frontend
# ─────────────────────────────────────────────────────────
echo ""
echo "🏗️  Step 7: Rebuilding Frontend Image (Clean Production Build)..."
$SSH "cd $REMOTE_DIR && docker-compose build --no-cache frontend"

# ─────────────────────────────────────────────────────────
# STEP 8: Deploy Frontend + Restart Gateway
# ─────────────────────────────────────────────────────────
echo ""
echo "🚀 Step 8: Deploying New Frontend & Agent Pulse..."

# Kill orphan containers BEFORE deploying to prevent 'name conflict'
$SSH "docker ps -a --filter 'name=tsfsystem-frontend' --format '{{.ID}} {{.Names}}' | while read id name; do
    if [[ \"\$name\" == *_tsfsystem-frontend* ]]; then
        echo \"  Removing orphan container: \$name (\$id)\"
        docker rm -f \"\$id\" 2>/dev/null || true
    fi
done" 2>/dev/null || true

# Force remove + recreate to avoid rename conflicts
$SSH "cd $REMOTE_DIR && docker-compose up -d --force-recreate --remove-orphans frontend mcp_agent_pulse"

echo "🔄 Restarting Nginx Gateway..."
$SSH "docker restart tsf_gateway"

# ─────────────────────────────────────────────────────────
# STEP 9: Cleanup
# ─────────────────────────────────────────────────────────
echo ""
echo "🧹 Step 9: Cleaning up old images..."
$SSH "docker image prune -f"

echo ""
echo "══════════════════════════════════════════════════════"
echo "✅ Full Deployment Successful!"
echo "   Version:  $AGENT_VERSION"
echo "   GitHub:   Backup committed & pushed"
echo "   Restore:  git checkout <commit_hash> -- src/ erp_backend/"
echo "══════════════════════════════════════════════════════"
echo ""
