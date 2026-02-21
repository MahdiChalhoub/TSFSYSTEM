#!/bin/bash

# deploy_production.sh
# The everything-in-one automation script for TSF ERP.

set -e

echo "🚀 Starting Ultra-Automation Deployment..."

# 1. Environment Generation
if [ ! -f ".env" ]; then
    echo "⚙️  Generating secure environment..."
    chmod +x scripts/generate_prod_env.sh
    ./scripts/generate_prod_env.sh
else
    echo "⏭️  .env already exists, skipping generation."
fi

# 2. Server Setup & Docker Build
echo "📦 Building architecture and initializing database..."
chmod +x setup_server.sh
./setup_server.sh <<EOF
y
EOF

# 3. Health Check
echo "🔍 Running final health check..."
# Give it a moment to finish starting
sleep 15

if docker ps | grep -q "tsf_backend" && docker ps | grep -q "tsf_frontend"; then
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo "==========================================="
    echo "Access your system: http://${SERVER_IP}:80"
    echo "==========================================="
else
    echo "❌ Deployment failed. Check 'docker ps' for running containers."
    exit 1
fi
