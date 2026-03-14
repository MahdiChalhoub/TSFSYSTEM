#!/usr/bin/env python3
"""
Emergency Schema Repair Script
Adds missing columns to systemmodule and organizationmodule tables.
Run with: ./venv/bin/python3 repair_schema.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

SQL_STATEMENTS = [
    "ALTER TABLE systemmodule ADD COLUMN IF NOT EXISTS description text DEFAULT '';",
    "ALTER TABLE systemmodule ADD COLUMN IF NOT EXISTS visibility varchar(20) DEFAULT 'public';",
    "ALTER TABLE systemmodule ADD COLUMN IF NOT EXISTS icon varchar(50) DEFAULT '';",
    "ALTER TABLE systemmodule ADD COLUMN IF NOT EXISTS manifest jsonb DEFAULT '{}';",
    "ALTER TABLE systemmodule ADD COLUMN IF NOT EXISTS checksum varchar(64) DEFAULT '';",
    "ALTER TABLE organizationmodule ADD COLUMN IF NOT EXISTS module_name varchar(100) DEFAULT 'legacy';",
    "ALTER TABLE organizationmodule ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;",
    "ALTER TABLE organizationmodule ADD COLUMN IF NOT EXISTS active_features jsonb DEFAULT '[]';",
]

def main():
    print("=== Schema Repair Starting ===")
    with connection.cursor() as cursor:
        for sql in SQL_STATEMENTS:
            try:
                cursor.execute(sql)
                print(f"  OK: {sql[:60]}...")
            except Exception as e:
                print(f"  WARN: {sql[:60]}... => {e}")
    
    # Verify
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'systemmodule' 
            ORDER BY ordinal_position
        """)
        cols = [row[0] for row in cursor.fetchall()]
        print(f"\nsystemmodule columns: {cols}")
        
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'organizationmodule' 
            ORDER BY ordinal_position
        """)
        cols = [row[0] for row in cursor.fetchall()]
        print(f"organizationmodule columns: {cols}")
    
    print("\n=== Schema Repair Complete ===")

if __name__ == '__main__':
    main()
