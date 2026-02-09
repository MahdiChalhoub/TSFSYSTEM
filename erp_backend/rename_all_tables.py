import psycopg2

def rename_tables_to_lowercase():
    try:
        conn = psycopg2.connect("dbname=tsfdb user=postgres password=postgres host=localhost")
        conn.autocommit = True
        cur = conn.cursor()
        
        # Get all table names
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = cur.fetchall()
        
        for table in tables:
            old_name = table[0]
            new_name = old_name.lower()
            
            if old_name != new_name:
                print(f"Renaming '{old_name}' to '{new_name}'...")
                try:
                    # Use double quotes for old name to handle mixed-case existing tables
                    cur.execute(f'ALTER TABLE "{old_name}" RENAME TO "{new_name}"')
                except Exception as e:
                    print(f"  Error renaming '{old_name}': {e}")
            else:
                print(f"Table '{old_name}' is already lowercase.")
        
        cur.close()
        conn.close()
        print("Done.")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    rename_tables_to_lowercase()
