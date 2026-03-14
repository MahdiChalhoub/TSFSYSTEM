import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

def wipe_public_schema():
    print("--- WIPING PUBLIC SCHEMA ---")
    with connection.cursor() as cursor:
        # Get all tables in public schema
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = [r[0] for r in cursor.fetchall()]
        
        print(f"Found {len(tables)} tables to drop.")
        for table in tables:
            print(f"Dropping table {table} CASCADE...")
            cursor.execute(f"DROP TABLE IF EXISTS \"{table}\" CASCADE")
        
        print("Schema wiped clean.")

if __name__ == "__main__":
    try:
        wipe_public_schema()
    except Exception as e:
        print(f"Wipe failed: {e}")
