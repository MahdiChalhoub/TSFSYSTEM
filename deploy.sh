#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# TSFSYSTEM — Production Deploy Script (tsf.ci)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./deploy.sh              → Full build + deploy
#   ./deploy.sh --quick      → Rebuild only backend + frontend (skip DB)
#   ./deploy.sh --migrate-db → Migrate dev DB to prod containers
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")

cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 TSFSYSTEM Production Deploy — $TIMESTAMP"
echo "═══════════════════════════════════════════════════════════════"

# ── 0. Pre-flight Checks ──────────────────────────────────────────────────────
echo ""
echo "🔍 Pre-flight checks..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose V2 not found."
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found. Create it from .env.prod.example"
    exit 1
fi

echo "  ✅ Docker $(docker --version | cut -d' ' -f3)"
echo "  ✅ Compose $(docker compose version | cut -d' ' -f4)"
echo "  ✅ Environment: $ENV_FILE"

# ── 1. Stop dev containers if running ─────────────────────────────────────────
echo ""
echo "📦 Stopping development containers (if running)..."
docker compose -f docker-compose.dev.yml down 2>/dev/null || true

# ── 2. Backup current database ────────────────────────────────────────────────
if docker volume ls | grep -q prod_pgdata; then
    echo ""
    echo "💾 Backing up production database..."
    mkdir -p /root/backup/db
    docker run --rm \
        -v tsfsystem_prod_pgdata:/data \
        -v /root/backup/db:/backup \
        alpine tar czf "/backup/pgdata_${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null || echo "  ⚠️  No previous prod DB to backup (first deploy)"
fi

# ── 3. Build ──────────────────────────────────────────────────────────────────
echo ""
if [ "$1" = "--quick" ]; then
    echo "⚡ Quick rebuild (backend + frontend only)..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend frontend
else
    echo "🏗️  Building all services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build
fi

# ── 4. Start services ────────────────────────────────────────────────────────
echo ""
echo "🚀 Starting production services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# ── 5. Wait for health ───────────────────────────────────────────────────────
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

MAX_WAIT=120
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    PG_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' tsf_prod_postgres 2>/dev/null || echo "starting")
    REDIS_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' tsf_prod_redis 2>/dev/null || echo "starting")
    
    if [ "$PG_HEALTH" = "healthy" ] && [ "$REDIS_HEALTH" = "healthy" ]; then
        echo "  ✅ PostgreSQL: healthy"
        echo "  ✅ Redis: healthy"
        break
    fi
    
    echo "  ⏳ Postgres=$PG_HEALTH, Redis=$REDIS_HEALTH (${ELAPSED}s)..."
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "❌ Services did not become healthy within ${MAX_WAIT}s"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs postgres redis
    exit 1
fi

# ── 6. Run migrations ────────────────────────────────────────────────────────
echo ""
echo "📦 Running Django migrations..."
docker exec tsf_prod_backend python manage.py migrate --noinput 2>&1 | tail -5

# ── 7. Collect static files ──────────────────────────────────────────────────
echo ""
echo "📦 Collecting static files..."
docker exec tsf_prod_backend python manage.py collectstatic --noinput 2>&1 | tail -3

# ── 8. Migrate dev DB to prod (optional) ─────────────────────────────────────
if [ "$1" = "--migrate-db" ]; then
    echo ""
    echo "📦 Migrating development database to production..."
    
    # Dump from dev containers
    DEV_POSTGRES=$(docker ps --format '{{.Names}}' | grep -E "tsfsystem.*postgres|tsf_postgres" | head -1)
    if [ -n "$DEV_POSTGRES" ]; then
        echo "  Dumping from $DEV_POSTGRES..."
        docker exec "$DEV_POSTGRES" pg_dump -U postgres -d tsfdb --clean --if-exists > /tmp/dev_db_dump.sql
        
        echo "  Loading into tsf_prod_postgres..."
        docker exec -i tsf_prod_postgres psql -U postgres -d tsfdb < /tmp/dev_db_dump.sql 2>&1 | tail -5
        rm -f /tmp/dev_db_dump.sql
        echo "  ✅ Database migrated successfully"
    else
        echo "  ⚠️  No dev postgres container found — skipping DB migration"
    fi
fi

# ── 9. Health Check ──────────────────────────────────────────────────────────
echo ""
echo "🔍 Final health check..."

SERVICES=("tsf_prod_postgres" "tsf_prod_redis" "tsf_prod_backend" "tsf_prod_frontend" "tsf_prod_gateway" "tsf_prod_celery" "tsf_prod_celery_beat")
FAILED=0

for svc in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$svc"; then
        STATUS=$(docker inspect --format='{{.State.Status}}' "$svc")
        echo "  ✅ $svc ($STATUS)"
    else
        echo "  ❌ $svc is NOT running"
        FAILED=1
    fi
done

echo ""
if [ $FAILED -eq 0 ]; then
    echo "═══════════════════════════════════════════════════════════════"
    echo "  ✅ DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "  🌐 https://tsf.ci"
    echo "  🔧 https://saas.tsf.ci"
    echo "  📊 Django Admin: https://tsf.ci/admin/"
    echo ""
    echo "  📋 Commands:"
    echo "    Logs:    docker compose -f $COMPOSE_FILE logs -f"
    echo "    Status:  docker compose -f $COMPOSE_FILE ps"
    echo "    Stop:    docker compose -f $COMPOSE_FILE down"
    echo "    Restart: docker compose -f $COMPOSE_FILE restart backend"
    echo "═══════════════════════════════════════════════════════════════"
else
    echo "⚠️  Some services failed. Check logs:"
    echo "  docker compose -f $COMPOSE_FILE logs"
    exit 1
fi
