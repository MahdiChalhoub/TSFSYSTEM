import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

def audit_tables():
    print("--- RAW DB TABLE AUDIT ---")
    with connection.cursor() as cursor:
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = [r[0] for r in cursor.fetchall()]
        print(f"Total tables found: {len(tables)}")
        for t in sorted(tables):
            print(f"  - {t}")
        
        print("\n--- MIGRATION STATUS ---")
        cursor.execute("SELECT app, name, applied FROM django_migrations ORDER BY applied DESC LIMIT 20")
        migrations = cursor.fetchall()
        for app, name, applied in migrations:
            print(f"  [{applied}] {app}: {name}")

if __name__ == "__main__":
    try:
        audit_tables()
    except Exception as e:
        print(f"Audit failed: {e}")
