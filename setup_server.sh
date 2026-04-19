#!/bin/bash

# setup_server.sh
# Automated Deployment & Setup Script for TSF ERP
# Usage: ./setup_server.sh

# Auto-detect docker compose command (v2 plugin vs v1 standalone)
if docker compose version &>/dev/null; then
    DC="docker compose"
elif command -v docker-compose &>/dev/null; then
    DC="docker-compose"
else
    echo "❌ Neither 'docker compose' (v2) nor 'docker-compose' (v1) found. Install Docker first."
    exit 1
fi

echo "==========================================="
echo "   TSF ERP - Server Setup & Deployment"
echo "==========================================="
echo "Using: $DC"

# 1. Update Codebase
echo ""
echo "⬇️  Pulling latest code from engine-stable..."

# Use GITHUB_TOKEN env var for auth if available
if [ -n "$GITHUB_TOKEN" ]; then
    git remote set-url origin "https://${GITHUB_TOKEN}@github.com/MahdiChalhoub/TSFSYSTEM.git"
fi

git fetch origin engine-stable
git reset --hard origin/engine-stable

# 2. Nuclear Clean (Fixes 'ContainerConfig' errors)
echo ""
echo "☢️  Cleaning up old/corrupted containers..."
$DC down --remove-orphans
docker rm -f $(docker ps -aq) 2>/dev/null || true

# 2.5 Port 80 Conflict Resolution
echo ""
echo "🔍  Checking for Port 80 conflicts..."
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 80 is occupied! Stopping conflicting services..."
    service apache2 stop 2>/dev/null || true
    service nginx stop 2>/dev/null || true
    fuser -k 80/tcp 2>/dev/null || true
    echo "✅  Port 80 freed."
fi

echo "✅  Clean complete."

# 3. Build & Start
echo ""
echo "🚀  Building and Starting Application..."
$DC up -d --build

echo "⏳  Waiting 15 seconds for containers to initialize..."
sleep 15

# 4. Interactive Setup
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
    echo "⏩  Skipping Database Wipe. Running migrations only..."
    docker exec -it tsf_backend python manage.py migrate
fi

echo ""
echo "==========================================="
echo "   DEPLOYMENT FINISHED"
echo "==========================================="
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Access your panel: http://${SERVER_IP}/login"
