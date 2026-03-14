import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

def deep_wipe():
    print("--- DEEP WIPING PUBLIC SCHEMA ---")
    with connection.cursor() as cursor:
        cursor.execute("DROP SCHEMA public CASCADE")
        cursor.execute("CREATE SCHEMA public")
        cursor.execute("GRANT ALL ON SCHEMA public TO public")
        cursor.execute("GRANT ALL ON SCHEMA public TO postgres")
        print("Dropped and recreated public schema.")

if __name__ == "__main__":
    try:
        deep_wipe()
    except Exception as e:
        print(f"Deep wipe failed: {e}")
