#!/bin/bash
set -e

echo "🚀 Starting TSF Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
while ! python -c "import django; django.setup(); from django.db import connection; connection.ensure_connection()" 2>/dev/null; do
    sleep 1
done
echo "✅ Database connected."

# Run migrations with fallback to --fake if columns already exist
echo "🛠️  Running Migrations..."
if ! python manage.py migrate 2>&1 | tee /tmp/migrate_output.txt; then
    if grep -q "DuplicateColumn\|already exists" /tmp/migrate_output.txt; then
        echo "⚠️  Detected existing columns. Faking migration..."
        python manage.py migrate erp --fake
        python manage.py migrate
        echo "✅ Migration state synchronized."
    else
        echo "❌ Migration failed with unknown error."
        cat /tmp/migrate_output.txt
        exit 1
    fi
fi

# Seed data if needed
if python -c "import django; django.setup(); from erp.models import Organization; exit(0 if Organization.objects.filter(slug='saas').exists() else 1)" 2>/dev/null; then
    echo "✅ SaaS organization already exists."
else
    echo "🌱 Seeding SaaS organization..."
    python manage.py shell -c "
from erp.models import Organization, GlobalCurrency, BusinessType
usd, _ = GlobalCurrency.objects.get_or_create(code='USD', defaults={'name': 'US Dollar', 'symbol': '\$'})
tech, _ = BusinessType.objects.get_or_create(slug='tech', defaults={'name': 'Technology'})
Organization.objects.get_or_create(slug='saas', defaults={'name': 'TSF City Central', 'is_active': True, 'business_type': tech, 'base_currency': usd})
print('✅ SaaS organization seeded.')
"
fi

echo "🏁 Starting Gunicorn..."
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 2 --threads 4 --timeout 120
