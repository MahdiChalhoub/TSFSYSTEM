#!/bin/bash

# setup_server.sh
# Automated Deployment & Setup Script for TSF ERP
# Usage: ./setup_server.sh

echo "==========================================="
echo "   TSF ERP - Server Setup & Deployment"
echo "==========================================="

# 1. Update Codebase (With Auto-Auth)
echo ""
echo "⬇️  Pulling latest code from engine-stable..."

# Configure Git to use the token for this session (locally scoped)
# We embed the token in the origin URL just for this operation to guarantee access
git remote set-url origin https://Chalhoub1995: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@github.com/MahdiChalhoub/TSFSYSTEM.git

git fetch origin engine-stable
git reset --hard origin/engine-stable

# 2. Nuclear Clean (Fixes 'ContainerConfig' errors)
echo ""
echo "☢️  Cleaning up old/corrupted containers..."
# Stop all running containers
docker-compose down --remove-orphans
# Force kill any zombies
docker rm -f $(docker ps -aq) 2>/dev/null || true
echo "✅  Clean complete."

# 3. Build & Start
echo ""
echo "🚀  Building and Starting Application..."
docker-compose up -d --build

echo "⏳  Waiting 10 seconds for containers to initialize..."
sleep 10

# 4. interactive Setup
echo ""
echo "==========================================="
echo "   DATABASE SETUP"
echo "==========================================="
read -p "Do you want to WIPE the database and start fresh? (y/n): " confirm

if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
    echo ""
    echo "🧹  Wiping Database..."
    docker exec -it tsf_backend python manage.py flush --no-input
    
    echo "🛠️  Running Migrations..."
    docker exec -it tsf_backend python manage.py migrate

    echo "👤  Create your Superuser (Follow the prompts)..."
    docker exec -it tsf_backend python manage.py createsuperuser

    echo "🌱  Seeding Data (Countries + SaaS Org + Auto-Link)..."
    docker exec -it tsf_backend python manage.py seed_core
    
    echo ""
    echo "✅  FRESH INSTALL COMPLETE!"
else
    echo ""
    echo "⏩  Skipping Database Wipe. Application updated."
fi

echo ""
echo "==========================================="
echo "   DEPLOYMENT FINISHED"
echo "==========================================="
echo "Access your panel: http://91.99.186.183:3000/saas/login"
