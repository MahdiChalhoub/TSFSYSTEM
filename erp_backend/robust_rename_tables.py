import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def rename_all_tables_to_lowercase():
    try:
        conn = psycopg2.connect(
            dbname="tsfdb",
            user="postgres",
            password="",
            host="localhost"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Get all tables in public schema
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        """)
        
        tables = [row[0] for row in cur.fetchall()]
        print(f"Found {len(tables)} tables.")
        
        for table in tables:
            if any(c.isupper() for c in table):
                lower_table = table.lower()
                print(f"Renaming '{table}' to '{lower_table}'...")
                try:
                    # Use double quotes for the old name to handle mixed case exactly
                    cur.execute(f'ALTER TABLE "{table}" RENAME TO "{lower_table}"')
                except Exception as e:
                    print(f"Failed to rename '{table}': {e}")
            else:
                print(f"Table '{table}' is already lowercase.")
        
        cur.close()
        conn.close()
        print("Done.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    rename_all_tables_to_lowercase()
