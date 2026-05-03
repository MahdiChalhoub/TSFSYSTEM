"""
Phase 1 of the scoped-attribute-values feature.

Adds three optional M2M scopes onto ProductAttribute. Empty = universal
(default) — existing values continue to behave exactly as before. Populated
= the value is only offered to products matching the scope.

Why M2M (not nullable FK):
    "Mango" can apply to both Juice AND Smoothie categories without
    duplicating the row. "EU sizes" can cover multiple EU countries.

Why on ProductAttribute (not a separate ScopedValue table):
    The model already unifies group + value via the parent FK
    (root = group, leaf = value). Adding fields here means no schema
    duplication. The fields are only meaningful on leaves; the helper
    in services.attribute_scope ignores scopes on roots.

This migration is data-safe:
    • Three new M2M tables, all initially empty.
    • No existing rows touched.
    • Rollback drops the three through tables; no data loss.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0003_brand_code_field'),
        # The three target models live in inventory + reference. Their
        # latest initial migrations are enough to satisfy the FK targets.
        ('reference', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='productattribute',
            name='scope_categories',
            field=models.ManyToManyField(
                blank=True,
                help_text=(
                    'If set, this VALUE is only offered for products in '
                    'these categories. Empty = available to every category.'
                ),
                related_name='scoped_attribute_values',
                to='inventory.category',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='scope_countries',
            field=models.ManyToManyField(
                blank=True,
                help_text=(
                    'If set, this VALUE is only offered for products whose '
                    'country is one of these. Empty = available in every country.'
                ),
                related_name='scoped_attribute_values',
                to='reference.country',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='scope_brands',
            field=models.ManyToManyField(
                blank=True,
                help_text=(
                    'If set, this VALUE is only offered for products of '
                    'these brands. Empty = available for every brand.'
                ),
                related_name='scoped_attribute_values',
                to='inventory.brand',
            ),
        ),
    ]
