"""Extract business table columns and data from SQL dump."""
import re, sys, os

SQL_FILE = r'C:\Users\chalh\Downloads\u739151801_dataPOS.sql'

# We need to find column names for tables that have them in the INSERT statements
# UltimatePOS phpMyAdmin exports include: INSERT INTO `table` (`col1`, `col2`, ...) VALUES (...)

tables_to_check = ['business', 'business_locations', 'contacts', 'products', 
                    'transactions', 'categories', 'brands', 'units', 'accounts',
                    'variations', 'transaction_sell_lines', 'purchase_lines',
                    'variation_location_details', 'currencies']

table_columns = {}

with open(SQL_FILE, 'r', encoding='utf-8', errors='replace') as f:
    for line in f:
        for table in tables_to_check:
            pattern = rf"INSERT\s+INTO\s+`{table}`\s*\(([^)]+)\)\s*VALUES"
            m = re.match(pattern, line, re.I)
            if m and table not in table_columns:
                cols = [c.strip().strip('`').strip() for c in m.group(1).split(',')]
                table_columns[table] = cols
        
        if len(table_columns) == len(tables_to_check):
            break

# Output results
for table in sorted(table_columns.keys()):
    cols = table_columns[table]
    print(f"\n=== {table} ({len(cols)} columns) ===")
    for i, c in enumerate(cols):
        print(f"  '{c}',")

# Also output in Python dict format for copy-paste into parser
print("\n\n# ===== PYTHON DICT FORMAT =====")
print("TABLE_COLUMNS = {")
for table in sorted(table_columns.keys()):
    cols = table_columns[table]
    print(f"    '{table}': [")
    for c in cols:
        print(f"        '{c}',")
    print(f"    ],")
print("}")
