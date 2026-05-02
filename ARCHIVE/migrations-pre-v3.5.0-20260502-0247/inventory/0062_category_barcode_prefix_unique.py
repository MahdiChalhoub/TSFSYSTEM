"""
Partial unique index on Category.barcode_prefix per tenant.

Closes the concurrent-save race the serializer validator alone can't
prevent: two sessions passing the pre-check at the same moment could
both persist the same prefix. The DB now refuses any second row with
the same (tenant_id, barcode_prefix). Empty strings are excluded so
"no prefix set" is the default.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0061_category_barcode_prefix'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE UNIQUE INDEX IF NOT EXISTS category_bp_unique_per_tenant
                    ON category(tenant_id, barcode_prefix)
                    WHERE barcode_prefix IS NOT NULL AND barcode_prefix <> '';
            """,
            reverse_sql="DROP INDEX IF EXISTS category_bp_unique_per_tenant;",
        ),
    ]
