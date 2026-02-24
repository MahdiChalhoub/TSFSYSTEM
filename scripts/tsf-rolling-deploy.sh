#!/bin/bash
# TSFSYSTEM Zero-Downtime Rolling Deployment Script
# =================================================
# This script performs a rolling update of the backend/frontend services
# by scaling up, waiting for healthchecks, and then scaling down.
# Requires: docker-compose v2.x

set -e

SERVICE=${1:-backend}
SCALE=${2:-2}

echo "🚀 Starting zero-downtime deployment for service: $SERVICE"

# 1. Build the latest image
echo "📦 Building latest image for $SERVICE..."
docker compose build $SERVICE

# 2. Get the current container ID(s) to remove later
OLD_CONTAINERS=$(docker compose ps -q $SERVICE)

# 3. Scale up to the new version
echo "📈 Scaling up $SERVICE to $SCALE instances..."
# We use --no-recreate so the old one stays running while the new one starts
docker compose up -d --scale $SERVICE=$SCALE --no-recreate $SERVICE

# 4. Wait for the new containers to be healthy
echo "⏳ Waiting for new instances to pass healthchecks..."
# Simple wait loop — in production use 'docker inspect' for 'status: healthy'
MAX_RETRIES=30
RETRY_COUNT=0
until [[ $(docker ps --filter "name=${SERVICE}" --filter "health=healthy" | wc -l) -ge $SCALE ]] || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    printf "."
    sleep 2
    ((RETRY_COUNT++))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Timeout waiting for healthy instances. Rolling back..."
    docker compose up -d --scale $SERVICE=1 --no-recreate $SERVICE
    exit 1
fi

echo -e "\n✅ New instances are healthy!"

# 5. Remove the old containers
echo "🧹 Removing old container(s)..."
for ID in $OLD_CONTAINERS; do
    echo "   Removing $ID"
    docker stop $ID
    docker rm $ID
done

# 6. Final scale normalization (to ensure Compose state is clean)
docker compose up -d --scale $SERVICE=1 $SERVICE

echo "🎉 Deployment of $SERVICE successful and zero-downtime achieved!"
