import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def debug_tables():
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT schemaname, tablename, tableowner 
            FROM pg_tables 
            WHERE tablename ILIKE 'plancategory'
            OR tablename ILIKE 'subscriptionpayment'
        """)
        rows = cursor.fetchall()
        print("Detected tables with exact casing:")
        for row in rows:
            print(f"Schema: {row[0]}, Table: {row[1]}, Owner: {row[2]}")

if __name__ == "__main__":
    debug_tables()
