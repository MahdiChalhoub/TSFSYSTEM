# Generated manually to create missing SystemModuleLog table
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0029_seed_kernel_version'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS "erp_systemmodulelog" (
                    "id" bigserial PRIMARY KEY,
                    "module_name" varchar(100) NOT NULL,
                    "from_version" varchar(50) NOT NULL DEFAULT 'N/A',
                    "to_version" varchar(50) NOT NULL DEFAULT 'N/A',
                    "action" varchar(20) NOT NULL,
                    "status" varchar(20) NOT NULL,
                    "logs" text NOT NULL DEFAULT '',
                    "performed_by_id" integer REFERENCES "User"("id") ON DELETE SET NULL,
                    "timestamp" timestamp with time zone NOT NULL DEFAULT NOW()
                );
            """,
            reverse_sql="DROP TABLE IF EXISTS erp_systemmodulelog;"
        ),
    ]
