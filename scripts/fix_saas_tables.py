import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def fix_table_names():
    with connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        tables = [row[0] for row in cursor.fetchall()]

        # Find PascalCase tables
        pascal_tables = [t for t in tables if any(c.isupper() for c in t)]
        print(f"Detected PascalCase tables: {pascal_tables}")

        for old_name in pascal_tables:
            new_name = old_name.lower()
            # Check if lowercase version already exists
            if new_name in tables:
                print(f"Skipping {old_name}: {new_name} already exists. Might need manual merge if data exists.")
                # If it's a legacy erp table that and a new module table, it's tricky.
                # But for SaaS models, there should only be one.
                continue
            
            print(f"Renaming \"{old_name}\" to \"{new_name}\"...")
            cursor.execute(f"ALTER TABLE \"{old_name}\" RENAME TO \"{new_name}\"")

        # Handle erp_ prefix as well (cleanup from before)
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'erp_%'")
        erp_tables = [row[0] for row in cursor.fetchall()]
        for old_name in erp_tables:
            new_name = old_name.replace('erp_', '').lower()
            # Check if lowercase version already exists
            cursor.execute(f"SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = '{new_name}'")
            if cursor.fetchone()[0] == 0:
                print(f"Renaming \"{old_name}\" to \"{new_name}\"...")
                cursor.execute(f"ALTER TABLE \"{old_name}\" RENAME TO \"{new_name}\"")

if __name__ == "__main__":
    fix_table_names()
