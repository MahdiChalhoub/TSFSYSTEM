"""
Migration 0029: Category creation rules.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0028_barcode_packaging_governance'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── CategoryCreationRule ─────────────────────────────────────
        migrations.CreateModel(
            name='CategoryCreationRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                # Required fields
                ('requires_barcode', models.BooleanField(default=False)),
                ('requires_brand', models.BooleanField(default=False)),
                ('requires_unit', models.BooleanField(default=True)),
                ('requires_packaging', models.BooleanField(default=False)),
                ('requires_photo', models.BooleanField(default=False)),
                ('requires_supplier', models.BooleanField(default=False)),
                # Barcode overrides
                ('barcode_prefix', models.CharField(blank=True, default='', max_length=10)),
                ('barcode_mode_override', models.CharField(blank=True, choices=[
                    ('', 'Use org default'), ('INTERNAL_AUTO', 'Always auto-generate'),
                    ('SUPPLIER', 'Supplier barcode required'), ('MANUAL', 'Manual entry only'),
                ], default='', max_length=15)),
                # Defaults
                ('default_product_type', models.CharField(blank=True, choices=[
                    ('', 'Use form selection'), ('STANDARD', 'Standard'), ('COMBO', 'Combo'),
                    ('SERVICE', 'Service'), ('BLANK', 'Blank / Internal'), ('FRESH', 'Fresh / Variable Weight'),
                ], default='', max_length=20)),
                ('default_unit_id', models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='default_for_categories', to='inventory.unit')),
                ('default_tva_rate', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                # Packaging
                ('auto_create_packaging', models.BooleanField(default=False)),
                ('packaging_template', models.JSONField(blank=True, default=list)),
                # Completeness
                ('completeness_profile_override', models.CharField(blank=True, choices=[
                    ('', 'Use product_type default'), ('STANDARD', 'Full L0-L7'),
                    ('COMBO', 'L0-L4'), ('SERVICE', 'L0-L2'),
                ], default='', max_length=20)),
                # Print/Label
                ('auto_print_label', models.BooleanField(default=True)),
                ('label_template', models.CharField(blank=True, default='', max_length=50)),
                ('shelf_placement_required', models.BooleanField(default=True)),
                # FKs
                ('category', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='creation_rule', to='inventory.category')),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
            ],
            options={
                'db_table': 'category_creation_rule',
            },
        ),

        # ── Expand Product.product_type choices ──────────────────────
        migrations.AlterField(
            model_name='product',
            name='product_type',
            field=models.CharField(choices=[
                ('STANDARD', 'Standard'), ('COMBO', 'Combo / Bundle'),
                ('SERVICE', 'Service'), ('BLANK', 'Blank / Internal / Repack'),
                ('FRESH', 'Fresh / Variable Weight'),
            ], default='STANDARD', max_length=20),
        ),
    ]
