import psycopg2

def cleanup():
    try:
        conn = psycopg2.connect(dbname='tsfdb', user='postgres', password='', host='localhost')
        conn.autocommit = True
        cur = conn.cursor()
        
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = [r[0] for r in cur.fetchall()]
        
        # Identify mixed-case tables to drop
        for t in tables:
            if any(c.isupper() for c in t):
                print(f"Dropping mixed-case table: {t}")
                cur.execute(f'DROP TABLE "{t}" CASCADE')
        
        cur.close()
        conn.close()
        print("Cleanup of mixed-case tables complete.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    cleanup()
