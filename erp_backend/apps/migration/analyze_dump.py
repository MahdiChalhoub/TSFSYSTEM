"""Quick script to analyze the SQL dump — run with: python apps/migration/analyze_dump.py"""
import re, sys, os

SQL_FILE = r'C:\Users\chalh\Downloads\u739151801_dataPOS.sql'

table_rows = {}
business_ids = set()

print(f"Analyzing: {SQL_FILE}")
print(f"Size: {os.path.getsize(SQL_FILE) / (1024*1024):.1f} MB")

with open(SQL_FILE, 'r', encoding='utf-8', errors='replace') as f:
    for line in f:
        m = re.match(r"INSERT\s+INTO\s+`?(\w+)`?\s", line, re.IGNORECASE)
        if m:
            table = m.group(1)
            count = line.count('),(') + 1
            table_rows[table] = table_rows.get(table, 0) + count
            
            # Extract business_ids from business table
            if table == 'business':
                ids = re.findall(r"\((\d+),", line)
                business_ids.update(ids)

print(f"\n{'='*60}")
print(f"TABLES FOUND: {len(table_rows)}")
print(f"{'='*60}")
print(f"{'Table':<40} {'Rows':>10}")
print(f"{'-'*40} {'-'*10}")
for t in sorted(table_rows.keys()):
    print(f"{t:<40} {table_rows[t]:>10}")

total = sum(table_rows.values())
print(f"{'-'*40} {'-'*10}")
print(f"{'TOTAL':<40} {total:>10}")

if business_ids:
    print(f"\nBusiness IDs found: {sorted(business_ids)}")
