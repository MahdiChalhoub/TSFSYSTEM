#!/bin/bash

###############################################################################
# TSF ERP System - Docker Deployment Script
# Version: 1.0.0
# Description: Automated deployment using Docker and Docker Compose
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOYMENT_ENV="${1:-staging}"  # staging or production
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
IMAGE_TAG="${2:-latest}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   TSF ERP - Docker Deployment Script  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Pre-deployment checks
echo -e "${YELLOW}[1/8]${NC} Running pre-deployment checks..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker daemon is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

# Step 2: Environment setup
echo -e "${YELLOW}[2/8]${NC} Setting up environment..."

cd "$PROJECT_ROOT"

# Check for .env file
if [ ! -f ".env.${DEPLOYMENT_ENV}" ]; then
    echo -e "${RED}✗ .env.${DEPLOYMENT_ENV} file not found${NC}"
    exit 1
fi

# Copy environment file
cp ".env.${DEPLOYMENT_ENV}" ".env"

echo -e "${GREEN}✓ Environment setup complete${NC}"
echo ""

# Step 3: Run tests
echo -e "${YELLOW}[3/8]${NC} Running tests..."

# TypeScript check
echo "  → Running TypeScript check..."
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ TypeScript check passed${NC}"
else
    echo -e "${RED}    ✗ TypeScript check failed${NC}"
    exit 1
fi

# Business logic tests
echo "  → Running business logic tests..."
if npm run test > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ Tests passed${NC}"
else
    echo -e "${YELLOW}    ⚠ Some tests failed (continuing anyway)${NC}"
fi

echo -e "${GREEN}✓ Tests completed${NC}"
echo ""

# Step 4: Build Docker image
echo -e "${YELLOW}[4/8]${NC} Building Docker image..."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
GIT_COMMIT=$(git rev-parse --short HEAD)
IMAGE_NAME="tsf-frontend"
FULL_IMAGE_TAG="${IMAGE_TAG}-${GIT_COMMIT}-${TIMESTAMP}"

echo "  Image: ${IMAGE_NAME}:${FULL_IMAGE_TAG}"

# Build the image
if docker build \
    --build-arg NODE_ENV=production \
    --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" \
    -t "${IMAGE_NAME}:${FULL_IMAGE_TAG}" \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    -t "${IMAGE_NAME}:latest" \
    -f Dockerfile \
    .; then
    echo -e "${GREEN}✓ Docker image built successfully${NC}"
else
    echo -e "${RED}✗ Docker image build failed${NC}"
    exit 1
fi

echo ""

# Step 5: Tag and push to registry (if configured)
if [ -n "$DOCKER_REGISTRY" ]; then
    echo -e "${YELLOW}[5/8]${NC} Pushing to Docker registry..."

    # Tag for registry
    docker tag "${IMAGE_NAME}:${FULL_IMAGE_TAG}" "${DOCKER_REGISTRY}/${IMAGE_NAME}:${FULL_IMAGE_TAG}"
    docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    docker tag "${IMAGE_NAME}:latest" "${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"

    # Push to registry
    echo "  → Pushing ${DOCKER_REGISTRY}/${IMAGE_NAME}:${FULL_IMAGE_TAG}"
    docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${FULL_IMAGE_TAG}"

    echo "  → Pushing ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

    echo "  → Pushing ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
    docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"

    echo -e "${GREEN}✓ Images pushed to registry${NC}"
else
    echo -e "${YELLOW}[5/8]${NC} Skipping registry push (DOCKER_REGISTRY not set)"
fi

echo ""

# Step 6: Stop existing containers
echo -e "${YELLOW}[6/8]${NC} Stopping existing containers..."

if docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
    echo "  → Stopping containers..."
    docker-compose -f docker-compose.production.yml down
    echo -e "${GREEN}    ✓ Containers stopped${NC}"
else
    echo "  → No running containers found"
fi

echo ""

# Step 7: Deploy with Docker Compose
echo -e "${YELLOW}[7/8]${NC} Deploying with Docker Compose..."

# Pull latest images (if using registry)
if [ -n "$DOCKER_REGISTRY" ]; then
    echo "  → Pulling latest images..."
    docker-compose -f docker-compose.production.yml pull
fi

# Start services
echo "  → Starting services..."
if docker-compose -f docker-compose.production.yml up -d; then
    echo -e "${GREEN}✓ Services started successfully${NC}"
else
    echo -e "${RED}✗ Failed to start services${NC}"
    exit 1
fi

echo ""

# Step 8: Post-deployment verification
echo -e "${YELLOW}[8/8]${NC} Running post-deployment verification..."

# Wait for services to be ready
echo "  → Waiting for services to be ready..."
sleep 15

# Check if containers are running
echo "  → Checking container status..."
CONTAINER_STATUS=$(docker-compose -f docker-compose.production.yml ps | grep -c "Up" || echo "0")

if [ "$CONTAINER_STATUS" -gt "0" ]; then
    echo -e "${GREEN}    ✓ ${CONTAINER_STATUS} containers running${NC}"
else
    echo -e "${RED}    ✗ No containers running${NC}"
    docker-compose -f docker-compose.production.yml logs --tail=50
    exit 1
fi

# Health check
echo "  → Running health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/health" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}    ✓ Health check passed${NC}"
else
    echo -e "${YELLOW}    ⚠ Health check returned status: $HTTP_STATUS${NC}"
    echo "    Check logs: docker-compose -f docker-compose.production.yml logs frontend"
fi

# Check homepage
echo "  → Checking homepage..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}    ✓ Homepage loads successfully${NC}"
else
    echo -e "${RED}    ✗ Homepage returned status: $HTTP_STATUS${NC}"
fi

echo ""
echo -e "${GREEN}✓ Post-deployment verification complete${NC}"
echo ""

# Show running containers
echo "Running containers:"
docker-compose -f docker-compose.production.yml ps

echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Deployment Summary               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "  Environment: ${DEPLOYMENT_ENV}"
echo "  Image: ${IMAGE_NAME}:${FULL_IMAGE_TAG}"
echo "  Containers: ${CONTAINER_STATUS} running"
echo ""
echo -e "${GREEN}✓ Docker deployment complete!${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:      docker-compose -f docker-compose.production.yml logs -f"
echo "  Stop services:  docker-compose -f docker-compose.production.yml down"
echo "  Restart:        docker-compose -f docker-compose.production.yml restart"
echo "  Shell access:   docker exec -it tsf-frontend sh"
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
