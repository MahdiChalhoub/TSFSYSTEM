#!/bin/bash

# setup_server.sh
# Automated Deployment & Setup Script for TSF ERP
# Usage: ./setup_server.sh

echo "==========================================="
echo "   TSF ERP - Server Setup & Deployment"
echo "==========================================="

# 1. Update Codebase
echo ""
echo "⬇️  Pulling latest code..."

# In production, set GITHUB_TOKEN environment variable
if [ -n "$GITHUB_TOKEN" ]; then
    git remote set-url origin "https://${GITHUB_TOKEN}@github.com/MahdiChalhoub/TSFSYSTEM.git"
fi

git fetch origin engine-stable
git reset --hard origin/engine-stable

# 2. Nuclear Clean (Fixes 'ContainerConfig' errors)
echo ""
echo "☢️  Cleaning up old/corrupted containers..."
# Stop all running containers
docker-compose down --remove-orphans
# Force kill any zombies
docker rm -f $(docker ps -aq) 2>/dev/null || true

# 2.5 Port 80 Conflict Resolution
echo ""
echo "🔍  Checking for Port 80 conflicts..."
# Check if something is listening on port 80
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 80 is occupied! Stopping conflicting services..."
    # Try stopping common services
    service apache2 stop 2>/dev/null || true
    service nginx stop 2>/dev/null || true
    # Force kill if still running
    fuser -k 80/tcp 2>/dev/null || true
    echo "✅  Port 80 freed."
fi

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
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Access your panel: http://${SERVER_IP}:3000/saas/login"
