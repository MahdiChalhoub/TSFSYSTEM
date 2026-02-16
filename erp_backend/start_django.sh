#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# start_django.sh — TSF Platform Startup Script
# 
# Runs pre-flight checks before launching Gunicorn:
#   1. Apply pending migrations
#   2. Ensure SaaS org + superadmin exist (idempotent)
#   3. Start Gunicorn
# ──────────────────────────────────────────────────────────────────

set -e

BACKEND_DIR="/root/TSFSYSTEM/erp_backend"
VENV_DIR="$BACKEND_DIR/venv"

cd "$BACKEND_DIR"
source "$VENV_DIR/bin/activate"

echo "🔧 [1/3] Applying migrations..."
python manage.py migrate --no-input 2>&1 || echo "⚠️  Migration warnings (non-fatal)"

echo "🔧 [2/3] Ensuring platform integrity..."
python manage.py ensure_platform

echo "🚀 [3/3] Starting Gunicorn (with graceful restart config)..."
exec gunicorn core.wsgi:application \
    --config gunicorn.conf.py
