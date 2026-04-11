"""
V2 Attribute Tree + Variant Grouping
=====================================
- ProductAttribute: add parent (FK self), is_variant, sort_order, color_hex, image_url
- Category: add attributes M2M to ProductAttribute
- Brand: add attributes M2M to ProductAttribute
- Product: add attribute_values M2M, parent_product FK, is_parent bool
- ProductAttributeValue: rename related_name to legacy_values
- ProductVariant: rename related_name to legacy_variants
- Remove old unique constraint, add new tree-aware one
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0045_groupingrule_inventorygroup_enhancements'),
        ('erp', '0024_listview_policy'),
    ]

    operations = [
        # ── 1. ProductAttribute: Add tree fields ────────────────────────
        migrations.AddField(
            model_name='productattribute',
            name='parent',
            field=models.ForeignKey(
                blank=True, null=True,
                help_text='Null = root attribute group. Set = child value.',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='children',
                to='inventory.productattribute',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='is_variant',
            field=models.BooleanField(
                default=False,
                help_text='If True, values of this attribute define separate variant SKUs.',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='sort_order',
            field=models.IntegerField(default=0, help_text='Display ordering within parent group'),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='color_hex',
            field=models.CharField(
                blank=True, max_length=7, null=True,
                help_text='Optional color swatch (e.g. #FF0000 for Red)',
            ),
        ),
        migrations.AddField(
            model_name='productattribute',
            name='image_url',
            field=models.CharField(
                blank=True, max_length=500, null=True,
                help_text='Optional image for this attribute value',
            ),
        ),

        # ── 2. Remove old unique constraint, add tree-aware one ────────
        migrations.RunSQL(
            sql="ALTER TABLE product_attribute DROP CONSTRAINT IF EXISTS unique_attribute_name_tenant;",
            reverse_sql="",
        ),
        migrations.AddConstraint(
            model_name='productattribute',
            constraint=models.UniqueConstraint(
                fields=['name', 'parent', 'organization'],
                name='unique_attribute_name_parent_tenant',
            ),
        ),

        # ── 3. Category: add attributes M2M ────────────────────────────
        migrations.AddField(
            model_name='category',
            name='attributes',
            field=models.ManyToManyField(
                blank=True, related_name='categories',
                to='inventory.productattribute',
                help_text='Attribute groups relevant for products in this category',
            ),
        ),

        # ── 4. Brand: add attributes M2M ───────────────────────────────
        migrations.AddField(
            model_name='brand',
            name='attributes',
            field=models.ManyToManyField(
                blank=True, related_name='brands',
                to='inventory.productattribute',
                help_text='Attribute groups relevant for this brand',
            ),
        ),

        # ── 5. Product: add attribute_values M2M ───────────────────────
        migrations.AddField(
            model_name='product',
            name='attribute_values',
            field=models.ManyToManyField(
                blank=True, related_name='products_with_attribute',
                to='inventory.productattribute',
                help_text='Dynamic attribute values assigned to this product (leaf nodes)',
            ),
        ),

        # ── 6. Product: add parent_product FK ──────────────────────────
        migrations.AddField(
            model_name='product',
            name='parent_product',
            field=models.ForeignKey(
                blank=True, null=True,
                help_text='Parent product for variant grouping.',
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='variant_children',
                to='inventory.product',
            ),
        ),

        # ── 7. Product: add is_parent bool ─────────────────────────────
        migrations.AddField(
            model_name='product',
            name='is_parent',
            field=models.BooleanField(
                default=False,
                help_text='True = variant group parent (not sold directly)',
            ),
        ),

        # ── 8. Update related_names on legacy models ───────────────────
        migrations.AlterField(
            model_name='productattributevalue',
            name='attribute',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='legacy_values',
                to='inventory.productattribute',
            ),
        ),
        migrations.AlterField(
            model_name='productvariant',
            name='product',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='legacy_variants',
                to='inventory.product',
            ),
        ),
        migrations.AlterField(
            model_name='productvariant',
            name='attribute_values',
            field=models.ManyToManyField(
                related_name='legacy_variant_links',
                to='inventory.productattributevalue',
            ),
        ),

        # ── 9. Add ordering to ProductAttribute ────────────────────────
        migrations.AlterModelOptions(
            name='productattribute',
            options={'ordering': ['sort_order', 'name']},
        ),
    ]
