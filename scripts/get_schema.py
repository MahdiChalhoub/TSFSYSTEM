import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def get_table_schema(table_name):
    with connection.cursor() as cursor:
        cursor.execute(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position;
        """)
        rows = cursor.fetchall()
        print(f"--- Schema for {table_name} ---")
        for row in rows:
            print(f"Column: {row[0]}, Type: {row[1]}, Nullable: {row[2]}")

if __name__ == "__main__":
    get_table_schema('systemmodulelog')
