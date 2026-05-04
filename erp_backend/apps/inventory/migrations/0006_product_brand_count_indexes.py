"""Composite indexes that cover the brands-list count query.

The /inventory/brands/?with_counts=true endpoint runs three GROUP BY
queries against the products table: distinct categories per brand,
distinct countries per brand, and product count + null-bucket flags.
Each one filters by organization and groups by brand_id, so the leading
column on every helpful index is `organization_id` (always present
implicitly via the tenant queryset). With that and brand_id + the
filtered FK, Postgres can serve every aggregate from index pages
without touching product rows — keeping wall-time stable as the
catalogue grows toward 100k products.

Indexes are CREATE INDEX IF NOT EXISTS via RunSQL so this is safe to
re-apply on a partially-migrated tenant database.
"""
from django.db import migrations


SQL_FORWARD = [
    # The DB column is `tenant_id` (UUID) — the codebase exposes it
    # as `organization` on the ORM but the underlying column kept its
    # original name. Existing indexes (product_org_cat_active_idx
    # etc.) use the same convention, so we match.
    "CREATE INDEX IF NOT EXISTS product_brand_tenant_idx ON product (tenant_id, brand_id) WHERE brand_id IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS product_brand_category_idx ON product (tenant_id, brand_id, category_id) WHERE brand_id IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS product_brand_country_idx ON product (tenant_id, brand_id, country_id) WHERE brand_id IS NOT NULL;",
]
SQL_REVERSE = [
    "DROP INDEX IF EXISTS product_brand_country_idx;",
    "DROP INDEX IF EXISTS product_brand_category_idx;",
    "DROP INDEX IF EXISTS product_brand_tenant_idx;",
]


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_ai_scope_models'),
    ]

    operations = [
        migrations.RunSQL(
            sql=SQL_FORWARD,
            reverse_sql=SQL_REVERSE,
        ),
    ]
