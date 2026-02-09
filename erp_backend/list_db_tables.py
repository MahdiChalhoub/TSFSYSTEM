import psycopg2

def list_tables():
    try:
        conn = psycopg2.connect("dbname=tsfdb user=postgres password=postgres host=localhost")
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = cur.fetchall()
        print("Tables in database:")
        for table in sorted(tables):
            print(f" - {table[0]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_tables()
