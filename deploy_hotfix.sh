#!/bin/bash
set -e

# Version Configuration
AGENT_VERSION="3.2.1-AG-$(date +'%y%m%d.%H%M')"
echo "🚀 Preparing deployment for version: $AGENT_VERSION"

# Update version in branding
sed -i "s/version: \".*\"/version: \"$AGENT_VERSION\"/" src/lib/branding.ts

echo "📥 Step 1: Pulling remote changes to local (preserves remote-only edits)..."
rsync -avz -e "ssh -i ~/.ssh/id_deploy" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude 'venv' \
    --exclude '.venv' \
    --exclude '**/venv' \
    --exclude '**/.venv' \
    --exclude '**/__pycache__' \
    --exclude '.env' \
    --exclude 'db_data' \
    --exclude 'postgres_data' \
    --exclude 'deploy_hotfix.sh' \
    --exclude 'src/components/app-sidebar.tsx' \
    --exclude 'src/components/admin/Sidebar.tsx' \
    --exclude 'src/lib/branding.ts' \
    --exclude 'erp_backend/releases/' \
    --exclude 'releases/' \
    --exclude 'tmp/' \
    --exclude '.antigravity-server/' \
    --ignore-existing \
    root@91.99.186.183:/root/TSFSYSTEM/ /root/.gemini/antigravity/scratch/TSFSYSTEM/

echo "📤 Step 2: Pushing local changes to remote..."
rsync -avz -e "ssh -i ~/.ssh/id_deploy" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude 'venv' \
    --exclude '.venv' \
    --exclude '**/venv' \
    --exclude '**/.venv' \
    --exclude '**/__pycache__' \
    --exclude '.env' \
    --exclude 'db_data' \
    --exclude 'postgres_data' \
    --exclude 'erp_backend/releases/' \
    --exclude 'releases/' \
    --exclude 'tmp/' \
    --exclude '.antigravity-server/' \
    /root/.gemini/antigravity/scratch/TSFSYSTEM/ root@91.99.186.183:/root/TSFSYSTEM/

echo "📊 Applying Database Migrations..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker exec tsfsystem-backend-1 python manage.py makemigrations --noinput"
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker exec tsfsystem-backend-1 python manage.py migrate --noinput"

echo "🔄 Restarting Backend & Celery Services..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker restart tsfsystem-backend-1 tsfsystem-celery_worker-1 tsfsystem-celery_beat-1"

echo "🏗️  Rebuilding Frontend Image (Clean Production Build)..."
# Rebuilding image is safer than exec build as it clears .next and starts fresh
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "cd /root/TSFSYSTEM && docker-compose build --no-cache frontend"

echo "🚀 Deploying New Frontend & Agent Pulse..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "cd /root/TSFSYSTEM && docker-compose up -d frontend mcp_agent_pulse"

echo "🔄 Restarting Nginx Gateway..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker restart tsf_gateway"

echo "🧹 Cleaning up old images..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker image prune -f"

echo "✅ Full Deployment Successful! Version: $AGENT_VERSION"
