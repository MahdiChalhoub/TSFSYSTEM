"""
ProductPackaging — First-Class Object
Adds: name, sku, purchase prices, selling_price_ht, dimensions, weight,
      default flags, image_url, and unique SKU constraint.
"""
from django.db import migrations, models
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0022_remove_product_unique_product_sku_per_org_and_more'),
    ]

    operations = [
        # ── Identity fields ──
        migrations.AddField(
            model_name='productpackaging',
            name='name',
            field=models.CharField(
                max_length=200, null=True, blank=True,
                help_text='Display name for this package, e.g. "Pack of 6", "Carton 24"'
            ),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='sku',
            field=models.CharField(
                max_length=100, null=True, blank=True,
                help_text='Package-level SKU/reference (independent of product SKU)'
            ),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='image_url',
            field=models.CharField(max_length=500, null=True, blank=True, help_text='Package-specific image'),
        ),

        # ── Selling Price HT ──
        migrations.AddField(
            model_name='productpackaging',
            name='custom_selling_price_ht',
            field=models.DecimalField(
                max_digits=15, decimal_places=2, null=True, blank=True,
                help_text='Override selling price (HT) for this level'
            ),
        ),

        # ── Purchase Pricing ──
        migrations.AddField(
            model_name='productpackaging',
            name='purchase_price_ht',
            field=models.DecimalField(
                max_digits=15, decimal_places=2, default=Decimal('0.00'),
                help_text='Default purchase cost excl. tax for this packaging level'
            ),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='purchase_price_ttc',
            field=models.DecimalField(
                max_digits=15, decimal_places=2, default=Decimal('0.00'),
                help_text='Default purchase cost incl. tax for this packaging level'
            ),
        ),

        # ── Dimensions & Weight ──
        migrations.AddField(
            model_name='productpackaging',
            name='weight_kg',
            field=models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, help_text='Gross weight in kg'),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='length_cm',
            field=models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='width_cm',
            field=models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='height_cm',
            field=models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True),
        ),

        # ── Default flags ──
        migrations.AddField(
            model_name='productpackaging',
            name='is_default_purchase',
            field=models.BooleanField(default=False, help_text='Preferred packaging when creating purchase orders'),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='is_default_sale',
            field=models.BooleanField(default=False, help_text='Preferred packaging when adding to POS / sales orders'),
        ),

        # ── Unique SKU constraint ──
        migrations.AddConstraint(
            model_name='productpackaging',
            constraint=models.UniqueConstraint(
                fields=['sku', 'organization'],
                name='unique_packaging_sku',
                condition=models.Q(sku__isnull=False),
            ),
        ),
    ]
