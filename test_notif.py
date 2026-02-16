import sys
sys.path.insert(0, '/root/TSFSYSTEM/erp_backend')
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erp.settings")
import django
django.setup()

try:
    from erp.models import Notification
    print("Model imported OK")
    count = Notification.objects.count()
    print(f"Count: {count}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")

# Also check if the table exists
try:
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_catalog.pg_tables WHERE tablename LIKE '%notification%'")
        tables = cursor.fetchall()
        print(f"Notification tables: {tables}")
except Exception as e:
    print(f"TABLE CHECK ERROR: {type(e).__name__}: {e}")
