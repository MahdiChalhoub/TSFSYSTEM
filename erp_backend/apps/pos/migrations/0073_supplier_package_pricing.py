"""
Migration 0073: SupplierPackagePrice table + supplier_barcode on ProductSupplier.
"""
from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0072_product_snapshot_fields'),
        ('inventory', '0029_category_creation_rules'),
    ]

    operations = [
        # ── supplier_barcode on ProductSupplier ──────────────────────
        migrations.AddField(
            model_name='productsupplier',
            name='supplier_barcode',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Barcode the supplier uses for this product'),
        ),

        # ── SupplierPackagePrice ─────────────────────────────────────
        migrations.CreateModel(
            name='SupplierPackagePrice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('purchase_price_ht', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('purchase_price_ttc', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('currency', models.CharField(default='XOF', max_length=10)),
                ('min_qty', models.DecimalField(decimal_places=2, default=Decimal('1.00'), max_digits=15)),
                ('max_qty', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('valid_from', models.DateField(blank=True, null=True)),
                ('valid_until', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('supplier_barcode', models.CharField(blank=True, max_length=100, null=True)),
                ('supplier_ref', models.CharField(blank=True, max_length=100, null=True)),
                ('is_default_purchase_price', models.BooleanField(default=False)),
                ('product_supplier', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='package_prices', to='pos.productsupplier')),
                ('packaging', models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='supplier_prices', to='inventory.productpackaging')),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
            ],
            options={
                'db_table': 'supplier_package_price',
                'ordering': ['min_qty'],
            },
        ),
        migrations.AddIndex(
            model_name='supplierpackageprice',
            index=models.Index(
                fields=['product_supplier', 'packaging', 'is_active'],
                name='spp_supplier_pkg_active_idx',
            ),
        ),
        migrations.AddConstraint(
            model_name='supplierpackageprice',
            constraint=models.UniqueConstraint(
                fields=['product_supplier', 'packaging', 'min_qty', 'organization'],
                name='unique_spp_per_supplier_pkg_qty',
            ),
        ),
    ]
