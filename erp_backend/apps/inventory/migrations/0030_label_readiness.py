"""
Migration 0030: Label governance + operational readiness.

- LabelPolicy (org-level singleton)
- LabelRecord (immutable print history with snapshots)
- ProductReadiness (5-dimensional operational readiness)
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0029_category_creation_rules'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── LabelPolicy ─────────────────────────────────────────────
        migrations.CreateModel(
            name='LabelPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('auto_invalidate_on', models.CharField(choices=[
                    ('BARCODE_CHANGE', 'On barcode change'),
                    ('PRICE_CHANGE', 'On price change'),
                    ('BOTH', 'On barcode or price change'),
                    ('MANUAL', 'Manual only'),
                ], default='BOTH', max_length=15)),
                ('require_reprint_after_price_change', models.BooleanField(default=True)),
                ('require_reprint_after_barcode_change', models.BooleanField(default=True)),
                ('default_shelf_template', models.CharField(blank=True, default='shelf_standard', max_length=50)),
                ('default_packaging_template', models.CharField(blank=True, default='packaging_standard', max_length=50)),
                ('default_fresh_template', models.CharField(blank=True, default='fresh_weight', max_length=50)),
                ('retention_days', models.IntegerField(default=365)),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
            ],
            options={'db_table': 'label_policy'},
        ),
        migrations.AddConstraint(
            model_name='labelpolicy',
            constraint=models.UniqueConstraint(fields=['organization'], name='unique_label_policy_per_org'),
        ),

        # ── LabelRecord ─────────────────────────────────────────────
        migrations.CreateModel(
            name='LabelRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('label_type', models.CharField(choices=[
                    ('SHELF', 'Shelf'), ('BARCODE', 'Barcode'),
                    ('PACKAGING', 'Packaging'), ('FRESH', 'Fresh/weight'), ('CUSTOM', 'Custom'),
                ], default='SHELF', max_length=10)),
                ('template_name', models.CharField(default='shelf_standard', max_length=50)),
                ('status', models.CharField(choices=[
                    ('VALID', 'Valid'), ('INVALIDATED', 'Invalidated'), ('REPRINTED', 'Reprinted'),
                ], default='VALID', max_length=15)),
                ('reason', models.CharField(choices=[
                    ('INITIAL', 'Initial'), ('PRICE_CHANGE', 'Price changed'),
                    ('BARCODE_CHANGE', 'Barcode changed'), ('RESTOCK', 'Restock'),
                    ('DAMAGED', 'Damaged'), ('CORRECTION', 'Correction'), ('MANUAL', 'Manual'),
                ], default='INITIAL', max_length=15)),
                ('printed_name', models.CharField(max_length=255)),
                ('printed_barcode', models.CharField(blank=True, max_length=100, null=True)),
                ('printed_price', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('printed_unit', models.CharField(blank=True, max_length=50, null=True)),
                ('version', models.PositiveIntegerField(default=1)),
                ('printed_at', models.DateTimeField(auto_now_add=True)),
                ('invalidated_at', models.DateTimeField(blank=True, null=True)),
                ('invalidated_reason', models.CharField(blank=True, default='', max_length=255)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name='label_records', to='inventory.product')),
                ('packaging', models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='label_records', to='inventory.productpackaging')),
                ('printed_by', models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='printed_labels', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
            ],
            options={
                'db_table': 'label_record',
                'ordering': ['-printed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='labelrecord',
            index=models.Index(fields=['product', 'status'], name='lr_product_status_idx'),
        ),
        migrations.AddIndex(
            model_name='labelrecord',
            index=models.Index(fields=['organization', 'printed_at'], name='lr_org_printed_idx'),
        ),

        # ── ProductReadiness ─────────────────────────────────────────
        migrations.CreateModel(
            name='ProductReadiness',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_scan_ready', models.BooleanField(default=False)),
                ('is_label_ready', models.BooleanField(default=False)),
                ('is_shelf_ready', models.BooleanField(default=False)),
                ('is_purchase_ready', models.BooleanField(default=False)),
                ('is_replenishment_ready', models.BooleanField(default=False)),
                ('last_assessed_at', models.DateTimeField(auto_now=True)),
                ('last_assessed_by', models.CharField(default='system', max_length=50)),
                ('product', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='readiness', to='inventory.product')),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
            ],
            options={'db_table': 'product_readiness'},
        ),
    ]
