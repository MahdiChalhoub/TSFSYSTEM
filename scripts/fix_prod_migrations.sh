#!/bin/bash
# Fix migrations on production fresh DB
set -e
cd /root/TSFSYSTEM/erp_backend
source venv/bin/activate

echo "=== Current tables ==="
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp_system.settings')
django.setup()
from django.db import connection
c = connection.cursor()
c.execute(\"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name\")
for r in c.fetchall():
    print(f'  {r[0]}')
"

echo ""
echo "=== Faking remaining erp migrations ==="
python manage.py migrate erp --fake 2>&1 | tail -10

echo ""
echo "=== Faking all module migrations ==="
python manage.py migrate crm --fake 2>&1 | tail -5
python manage.py migrate finance --fake 2>&1 | tail -5
python manage.py migrate inventory --fake 2>&1 | tail -5
python manage.py migrate pos --fake 2>&1 | tail -5
python manage.py migrate hr --fake 2>&1 | tail -5
python manage.py migrate mcp --fake 2>&1 | tail -5
python manage.py migrate packages --fake 2>&1 | tail -5

echo ""
echo "=== Migration state ==="
python manage.py showmigrations 2>&1 | grep -E '^\[' | tail -30

echo ""
echo "=== Django check ==="
python manage.py check 2>&1 | tail -5

echo ""
echo "=== Test DB connection ==="
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp_system.settings')
django.setup()
from django.db import connection
c = connection.cursor()
c.execute(\"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name\")
tables = [r[0] for r in c.fetchall()]
print(f'Total tables: {len(tables)}')
for t in tables:
    print(f'  {t}')
"
echo ""
echo "=== DONE ==="
