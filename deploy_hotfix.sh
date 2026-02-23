#!/bin/bash
set -e

# Version Configuration
AGENT_VERSION="2.8.2-AG-$(date +'%y%m%d.%H%M')"
echo "🚀 Preparing deployment for version: $AGENT_VERSION"

# Update version in branding
sed -i "s/version: \".*\"/version: \"$AGENT_VERSION\"/" src/lib/branding.ts

echo "📡 Syncing Codebase (Full Project Master)..."
# Sync the entire project root to remote /root/TSFSYSTEM/
# This includes .dockerignore, package.json, src/, erp_backend/, etc.
rsync -avz -e "ssh -i ~/.ssh/id_deploy" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude 'venv' \
    --exclude '__pycache__' \
    --exclude '.env' \
    --exclude 'db_data' \
    --exclude 'postgres_data' \
    /root/.gemini/antigravity/scratch/TSFSYSTEM/ root@91.99.186.183:/root/TSFSYSTEM/

echo "📊 Applying Database Migrations..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker exec tsf_backend python manage.py makemigrations migration"
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker exec tsf_backend python manage.py migrate"

echo "🔄 Restarting Backend Service..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker restart tsf_backend"

echo "🏗️  Rebuilding Frontend Image (Clean Production Build)..."
# Rebuilding image is safer than exec build as it clears .next and starts fresh
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "cd /root/TSFSYSTEM && docker-compose build --no-cache frontend"

echo "🚀 Deploying New Frontend Container..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "cd /root/TSFSYSTEM && docker-compose up -d frontend"

echo "🔄 Restarting Nginx Gateway..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker restart tsf_gateway"

echo "🧹 Cleaning up old images..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker image prune -f"

echo "✅ Full Deployment Successful! Version: $AGENT_VERSION"
