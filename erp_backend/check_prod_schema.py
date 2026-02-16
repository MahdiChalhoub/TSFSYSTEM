import os, sys, django
sys.path.insert(0, '/root/TSFSYSTEM/erp_backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from django.db import connection

cursor = connection.cursor()

# List all tables
cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
tables = [r[0] for r in cursor.fetchall()]
print("=== EXISTING TABLES ===")
for t in tables:
    print(f"  {t}")

# Check specific problem tables
problem_tables = ['manager_override_log', 'manageroverridelog', 'notification', 'udlesavedview', 'udle_saved_view']
print("\n=== PROBLEM TABLE CHECK ===")
for t in problem_tables:
    exists = t in tables
    print(f"  {t}: {'EXISTS' if exists else 'MISSING'}")

# Check user columns
cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name='user' ORDER BY column_name")
cols = [r[0] for r in cursor.fetchall()]
print("\n=== USER TABLE COLUMNS ===")
for c in cols:
    print(f"  {c}")
