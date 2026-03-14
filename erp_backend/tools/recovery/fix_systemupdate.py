#!/usr/bin/env python
"""Add missing columns to SystemUpdate table"""
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
import django
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Add package_hash column if not exists
    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'SystemUpdate' AND column_name = 'package_hash'
            ) THEN
                ALTER TABLE "SystemUpdate" ADD COLUMN "package_hash" varchar(64) NULL;
            END IF;
        END $$;
    """)
    print('Added package_hash column (if not existed)')
    
    # Add metadata column if not exists  
    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'SystemUpdate' AND column_name = 'metadata'
            ) THEN
                ALTER TABLE "SystemUpdate" ADD COLUMN "metadata" jsonb DEFAULT '{}';
            END IF;
        END $$;
    """)
    print('Added metadata column (if not existed)')
    
print('Done! SystemUpdate table now has package_hash and metadata fields.')
