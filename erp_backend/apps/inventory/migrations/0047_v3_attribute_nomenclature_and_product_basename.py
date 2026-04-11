"""
V3 Attribute Nomenclature & Product base_name
==============================================
Adds governance/nomenclature fields to ProductAttribute (root groups):
  - show_in_name: Whether values appear in auto-generated product name
  - name_position: Ordering in generated name
  - short_label: Abbreviated label (e.g. "ml" → "180ml")
  - is_required: Must select a value in linked categories
  - show_by_default: Show expanded in Add Product form

Adds base_name to Product:
  - Core product identity without brand/attributes
  - Used by nomenclature engine to generate full display name
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0046_v2_attribute_tree_and_variant_grouping'),
    ]

    operations = [
        # ── ProductAttribute: Nomenclature fields ──────────────────
        migrations.AddField(
            model_name='productattribute',
            name='show_in_name',
            field=models.BooleanField(
                default=False,
                help_text='If True, selected values appear in auto-generated product display name.',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='name_position',
            field=models.IntegerField(
                default=99,
                help_text='Position in the generated product name (lower = earlier).',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='short_label',
            field=models.CharField(
                max_length=30, null=True, blank=True,
                help_text='Abbreviated label for name generation (e.g. "ml" → "180ml").',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='is_required',
            field=models.BooleanField(
                default=False,
                help_text='If True, a value MUST be selected for products in linked categories.',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='show_by_default',
            field=models.BooleanField(
                default=True,
                help_text='If True, appears expanded by default in the Add/Edit Product form.',
            ),
        ),

        # ── Product: base_name ─────────────────────────────────────
        migrations.AddField(
            model_name='product',
            name='base_name',
            field=models.CharField(
                max_length=255, null=True, blank=True,
                help_text='Core product identity without brand or attributes. '
                          'Used by nomenclature engine to generate full display name.',
            ),
        ),
    ]
