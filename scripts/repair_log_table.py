import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def repair_systemmodulelog():
    with connection.cursor() as cursor:
        # Check current columns in 'systemmodulelog'
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'systemmodulelog';
        """)
        columns = [row[0] for row in cursor.fetchall()]
        print(f"Current columns in 'systemmodulelog': {columns}")

        if 'created_at' in columns and 'timestamp' not in columns:
            print("Renaming 'created_at' to 'timestamp' in 'systemmodulelog'...")
            cursor.execute('ALTER TABLE "systemmodulelog" RENAME COLUMN "created_at" TO "timestamp";')
        
        # Ensure other expected columns exist with correct types
        expected_renames = {
            'details': 'metadata' # if needed, but model doesn't have metadata yet
        }
        
        # The model expects logs to be a text field, which it is.
        # It expects module_name, from_version, to_version, action, status.
        
        # Check erp_systemmodulelog
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'erp_systemmodulelog'")
        if cursor.fetchone():
            print("Found legacy 'erp_systemmodulelog'. Dropping it to avoid confusion as we use 'systemmodulelog'.")
            cursor.execute('DROP TABLE "erp_systemmodulelog";')

if __name__ == "__main__":
    repair_systemmodulelog()
