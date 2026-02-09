import os
import django
import psycopg2
from django.apps import apps

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def audit_tables():
    # 1. Get all models and their db_table names
    model_tables = {}
    for model in apps.get_models():
        db_table = model._meta.db_table
        model_name = f"{model._meta.app_label}.{model.__name__}"
        model_tables[db_table.lower()] = {
            'actual_db_table': db_table,
            'model_name': model_name
        }
    
    # 2. Connect to DB and get actual table names
    try:
        conn = psycopg2.connect(
            dbname="tsfdb",
            user="postgres",
            password="",
            host="localhost"
        )
        cur = conn.cursor()
        
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        """)
        
        db_tables = [row[0] for row in cur.fetchall()]
        
        print(f"--- DB AUDIT START ---")
        print(f"Found {len(db_tables)} tables in DB.")
        print(f"Tracking {len(model_tables)} unique tables from Django models.\n")
        
        renames_needed = []
        missing_tables = []
        
        for db_table in db_tables:
            lower_db_table = db_table.lower()
            if any(c.isupper() for c in db_table):
                # This table has uppercase characters
                print(f"[MIXED CASE] DB Table: '{db_table}'")
                if lower_db_table in model_tables:
                    model_info = model_tables[lower_db_table]
                    print(f"  -> Matches Model: {model_info['model_name']}")
                    renames_needed.append((db_table, lower_db_table))
                else:
                    print(f"  -> No direct model match found for '{lower_db_table}'")
            else:
                # Already lowercase
                if lower_db_table not in model_tables:
                    # Might be a Django internal table or from an app we don't track closely, or just no model
                    pass
        
        # Check for missing tables (models that have no matching table in DB)
        db_tables_lower = [t.lower() for t in db_tables]
        for lower_model_table, info in model_tables.items():
            if lower_model_table not in db_tables_lower:
                missing_tables.append(info['model_name'])
        
        print(f"\n--- SUMMARY ---")
        print(f"Renames suggested: {len(renames_needed)}")
        for old, new in renames_needed:
            print(f"  ALTER TABLE \"{old}\" RENAME TO \"{new}\";")
            
        print(f"\nMissing tables in DB (for tracked models): {len(missing_tables)}")
        for m in missing_tables:
            print(f"  - {m}")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    audit_tables()
