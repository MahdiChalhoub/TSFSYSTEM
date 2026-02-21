#!/bin/bash
# Backend startup script with migration health check

set -e

echo "🔍 Checking database connection..."
python manage.py check --database default

echo "🔍 Checking migration health..."
python manage.py check_migrations --app erp || true

echo "📦 Applying pending migrations..."
python manage.py migrate --noinput

if [ "$DEBUG" = "1" ]; then
    echo "🚀 Starting Django development server..."
    exec python manage.py runserver 0.0.0.0:8000
else
    echo "🚀 Starting Gunicorn production server..."
    # Ensure log directory exists for gunicorn
    mkdir -p /var/log/tsf
    exec gunicorn core.wsgi:application -c gunicorn.conf.py
fi
