import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def list_all_tables():
    with connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        tables = [row[0] for row in cursor.fetchall()]
        print("\n".join(tables))

if __name__ == "__main__":
    list_all_tables()
