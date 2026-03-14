#!/usr/bin/env python
"""Create correct erp_systemmodulelog table"""
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
import django
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    print('Creating erp_systemmodulelog table...')
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS "erp_systemmodulelog" (
            "id" bigserial PRIMARY KEY,
            "module_name" varchar(100) NOT NULL,
            "from_version" varchar(50) NOT NULL,
            "to_version" varchar(50) NOT NULL,
            "action" varchar(20) NOT NULL,
            "status" varchar(20) NOT NULL,
            "logs" text NOT NULL,
            "performed_by_id" bigint NULL,
            "timestamp" timestamp with time zone NOT NULL DEFAULT now()
        );
    """)
    print('Table erp_systemmodulelog created!')
