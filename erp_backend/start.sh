#!/bin/bash
# Backend startup script with migration health check

set -e

echo "🔍 Checking database connection..."
python manage.py check --database default

echo "🔍 Checking migration health..."
python manage.py check_migrations --app erp || true

echo "📦 Applying pending migrations..."
python manage.py migrate --noinput

echo "🚀 Starting Django server..."
exec python manage.py runserver 0.0.0.0:8000
