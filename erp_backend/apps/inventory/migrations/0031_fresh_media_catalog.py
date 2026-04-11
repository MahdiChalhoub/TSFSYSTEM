"""
Migration 0031: Fresh/weighted product models + product media fields + readiness catalog dimension.

- WeightedProductPolicy (org-level singleton)
- ProductFreshProfile (per-product fresh attributes)
- Product.catalog_description, catalog_ready, media_count
- ProductReadiness.is_catalog_ready
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0030_label_readiness'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── WeightedProductPolicy ────────────────────────────────────
        migrations.CreateModel(
            name='WeightedProductPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('encoding_mode', models.CharField(choices=[
                    ('PRICE_EMBEDDED', 'Price embedded'), ('WEIGHT_EMBEDDED', 'Weight embedded'),
                    ('PLU', 'PLU code lookup'),
                ], default='PRICE_EMBEDDED', max_length=15)),
                ('scale_unit', models.CharField(choices=[
                    ('GRAMS', 'Grams'), ('CENTIGRAMS', 'Centigrams'), ('PRICE_CENTS', 'Price cents'),
                ], default='GRAMS', max_length=15)),
                ('prefix', models.CharField(default='2', max_length=5)),
                ('default_tare_grams', models.IntegerField(default=0)),
                ('require_tare_entry', models.BooleanField(default=False)),
                ('default_shelf_life_days', models.IntegerField(default=3)),
                ('require_best_before', models.BooleanField(default=True)),
                ('require_use_by', models.BooleanField(default=False)),
                ('label_template', models.CharField(default='fresh_weight', max_length=50)),
                ('show_price_per_kg', models.BooleanField(default=True)),
                ('show_ingredients', models.BooleanField(default=False)),
                ('show_allergens', models.BooleanField(default=False)),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
            ],
            options={'db_table': 'weighted_product_policy'},
        ),
        migrations.AddConstraint(
            model_name='weightedproductpolicy',
            constraint=models.UniqueConstraint(fields=['organization'], name='unique_weight_policy_per_org'),
        ),

        # ── ProductFreshProfile ──────────────────────────────────────
        migrations.CreateModel(
            name='ProductFreshProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('typical_weight_grams', models.IntegerField(default=0)),
                ('tare_weight_grams', models.IntegerField(default=0)),
                ('min_weight_grams', models.IntegerField(default=0)),
                ('max_weight_grams', models.IntegerField(default=0)),
                ('price_per_kg', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('plu_code', models.CharField(blank=True, default='', max_length=10)),
                ('shelf_life_days', models.IntegerField(default=3)),
                ('use_by_days', models.IntegerField(blank=True, null=True)),
                ('ingredients', models.TextField(blank=True, default='')),
                ('allergens', models.TextField(blank=True, default='')),
                ('storage_instructions', models.CharField(blank=True, default='', max_length=255)),
                ('origin_country', models.CharField(blank=True, default='', max_length=100)),
                ('product', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='fresh_profile', to='inventory.product')),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
            ],
            options={'db_table': 'product_fresh_profile'},
        ),

        # ── Product media/catalog fields ─────────────────────────────
        migrations.AddField(
            model_name='product',
            name='catalog_description',
            field=models.TextField(blank=True, null=True,
                help_text='Marketing/catalog description'),
        ),
        migrations.AddField(
            model_name='product',
            name='catalog_ready',
            field=models.BooleanField(default=False,
                help_text='Approved for catalog/eCommerce display'),
        ),
        migrations.AddField(
            model_name='product',
            name='media_count',
            field=models.PositiveIntegerField(default=0,
                help_text='Number of media assets attached'),
        ),

        # ── Readiness: catalog dimension ─────────────────────────────
        migrations.AddField(
            model_name='productreadiness',
            name='is_catalog_ready',
            field=models.BooleanField(default=False,
                help_text='Has image, catalog description, and is approved'),
        ),
    ]
