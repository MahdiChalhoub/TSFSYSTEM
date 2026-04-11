import django, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from django.db import connection
from erp.models import Organization

cursor = connection.cursor()
cursor.execute('SELECT id, username, organization_id FROM "User" WHERE organization_id IS NULL')
rows = cursor.fetchall()
print(f"Users with NULL org: {len(rows)}")
for r in rows:
    print(f"  id={r[0]} user={r[1]}")

if rows:
    saas_org = Organization.objects.get(slug='saas')
    print(f"\nFixing: assigning all to '{saas_org.name}' (id={saas_org.id})")
    cursor.execute('UPDATE "User" SET organization_id = %s WHERE organization_id IS NULL', [str(saas_org.id)])
    print(f"Updated {cursor.rowcount} rows")
