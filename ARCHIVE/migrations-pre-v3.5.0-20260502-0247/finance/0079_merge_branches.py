"""Merge migration — reconcile parallel 0076 leaf nodes.

Two independent migration branches both depended on 0075:

  0075_revaluation_overhaul
   ├── 0076_backfill_monetary_classification     (data migration)
   └── 0076_category_defaults_digital            (schema migration)
        └── 0077_payment_gateway_catalog
             └── 0078_payment_gateway_catalog

The branches touch disjoint concerns (chartofaccount.monetary_classification
vs. financialaccount/category digital-payment fields), so a no-op merge
node is sufficient to converge the tree. Schema operations remain inside
their original migrations.

If `manage.py makemigrations finance` reports drift after this lands,
that's a separate concern — a follow-up schema migration should resolve
it cleanly once the tree is linear.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0076_backfill_monetary_classification'),
        ('finance', '0078_payment_gateway_catalog'),
    ]

    operations = []
