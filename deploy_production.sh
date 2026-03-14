#!/bin/bash

# deploy_production.sh
# One-command deployment for TSF ERP.

set -e

echo "🚀 Starting Production Deployment..."

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
n
EOF

# 3. Health Check
echo "🔍 Running final health check..."
sleep 10

SERVICES=("tsf_backend" "tsf_frontend" "tsf_db" "tsf_redis" "tsf_gateway")
FAILED=0

for svc in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$svc"; then
        echo "  ✅ $svc is running"
    else
        echo "  ❌ $svc is NOT running"
        FAILED=1
    fi
done

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo "==========================================="
    echo "Access your system: http://${SERVER_IP}"
    echo "==========================================="
else
    echo ""
    echo "⚠️  Some services failed to start. Check: docker ps -a"
    exit 1
fi
