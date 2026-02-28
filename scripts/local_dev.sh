#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# TSF SYSTEM — Local Development Startup
# Starts: PostgreSQL (already running), Redis, Django, Celery, Next.js
# ═══════════════════════════════════════════════════════════════
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/erp_backend"
VENV="$PROJECT_DIR/venv/bin/activate"
PORT="${PORT:-3001}"

echo "═══════════════════════════════════════════════════════════"
echo "🚀 TSF SYSTEM — Local Development Environment"
echo "═══════════════════════════════════════════════════════════"

# 1. Check PostgreSQL
echo "🔍 Checking PostgreSQL..."
if ! pg_isready -q 2>/dev/null; then
    echo "❌ PostgreSQL is not running. Start it with: sudo systemctl start postgresql"
    exit 1
fi
echo "   ✅ PostgreSQL is running"

# 2. Start Redis if not running
echo "🔍 Checking Redis..."
if ! redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "   Starting Redis..."
    sudo systemctl start redis-server
fi
echo "   ✅ Redis is running"

# 3. Kill any existing processes on our ports
echo "🧹 Cleaning up old processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
# Don't kill port 3000 — it's used by the IDE
pgrep -f "celery.*worker" | xargs kill -9 2>/dev/null || true
pgrep -f "celery.*beat" | xargs kill -9 2>/dev/null || true
sleep 1

# 4. Start Django Backend
echo "🐍 Starting Django Backend (port 8000)..."
cd "$BACKEND_DIR"
source "$VENV"
python manage.py runserver 0.0.0.0:8000 &
DJANGO_PID=$!
sleep 3

# 5. Start Celery Worker
echo "⚡ Starting Celery Worker..."
cd "$BACKEND_DIR"
celery -A core worker -l info --concurrency=2 &
CELERY_PID=$!

# 6. Start Celery Beat
echo "⏰ Starting Celery Beat..."
cd "$BACKEND_DIR"
celery -A core beat -l info &
BEAT_PID=$!

# 7. Start Next.js Frontend
echo "🌐 Starting Next.js Frontend (port $PORT)..."
cd "$PROJECT_DIR"
npm run dev -- -H 0.0.0.0 -p "$PORT" &
NEXTJS_PID=$!

sleep 3
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ ALL SERVICES RUNNING!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 Frontend:    http://localhost:$PORT"
echo "🐍 Backend:     http://localhost:8000"
echo "📊 API Health:  http://localhost:8000/api/health/"
echo ""
echo "🏢 Access Points:"
echo "   Landing:     http://localhost:$PORT"
echo "   SaaS Panel:  http://saas.localhost:$PORT"
echo "   Demo Tenant: http://demo.localhost:$PORT"
echo ""
echo "👤 Login Credentials:"
echo "   SaaS Admin:   admin / admin123  (superuser)"
echo "   Demo Manager: manager / demo123"
echo "   Demo Cashier: cashier / demo123"
echo ""
echo "⚠️  Same security rules as production:"
echo "   • DJANGO_DEBUG=False"
echo "   • Tenant isolation active"
echo "   • CORS enforcement active"
echo "   • Rate limiting active"
echo ""
echo "Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════════════════════"

# Trap Ctrl+C to clean up
trap 'echo ""; echo "🛑 Shutting down..."; kill $DJANGO_PID $CELERY_PID $BEAT_PID $NEXTJS_PID 2>/dev/null; exit 0' INT TERM

# Wait for any process to exit
wait
