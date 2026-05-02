"""
Migration 0028: Barcode governance + packaging governance fields.

- Creates BarcodePolicy and ProductBarcode tables
- Adds barcode_source and barcode_generated_at to Product
- Adds packaging governance fields (is_verified, verified_at/by, label_printed_at, label_version)
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0027_product_task'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── BarcodePolicy (singleton per org) ────────────────────────
        migrations.CreateModel(
            name='BarcodePolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('mode', models.CharField(choices=[
                    ('SUPPLIER', 'Use supplier barcodes only'),
                    ('INTERNAL_AUTO', 'Auto-generate internal barcodes'),
                    ('MANUAL', 'Manual entry only'),
                    ('HYBRID', 'Supplier preferred, auto-generate if missing'),
                ], default='HYBRID', max_length=15)),
                ('prefix', models.CharField(default='2', max_length=20)),
                ('category_prefix_enabled', models.BooleanField(default=True)),
                ('format', models.CharField(choices=[
                    ('EAN13', 'EAN-13'), ('EAN8', 'EAN-8'),
                    ('CODE128', 'Code 128'), ('UPC_A', 'UPC-A'), ('FREE', 'Free format'),
                ], default='EAN13', max_length=10)),
                ('checksum_enabled', models.BooleanField(default=True)),
                ('uniqueness_scope', models.CharField(choices=[
                    ('ORGANIZATION', 'Unique within organization'),
                    ('GLOBAL', 'Globally unique'),
                ], default='ORGANIZATION', max_length=15)),
                ('auto_generate_on_create', models.BooleanField(default=True)),
                ('change_requires_approval', models.BooleanField(default=False)),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
            ],
            options={
                'db_table': 'barcode_policy',
            },
        ),
        migrations.AddConstraint(
            model_name='barcodepolicy',
            constraint=models.UniqueConstraint(fields=['organization'], name='unique_barcode_policy_per_org'),
        ),

        # ── ProductBarcode (multi-barcode per product) ───────────────
        migrations.CreateModel(
            name='ProductBarcode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('code', models.CharField(db_index=True, max_length=100)),
                ('barcode_type', models.CharField(choices=[
                    ('PRIMARY', 'Primary barcode'), ('ALIAS', 'Alternative barcode'),
                    ('SUPPLIER', 'Supplier barcode'), ('INTERNAL', 'Internally generated'),
                    ('PACKAGING', 'Packaging-level barcode'),
                ], default='PRIMARY', max_length=10)),
                ('source', models.CharField(choices=[
                    ('SCANNED', 'Scanned'), ('GENERATED', 'Auto-generated'),
                    ('MANUAL', 'Manually entered'), ('IMPORTED', 'Imported'),
                ], default='MANUAL', max_length=10)),
                ('is_active', models.BooleanField(default=True)),
                ('generated_at', models.DateTimeField(blank=True, null=True)),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name='barcodes', to='inventory.product')),
                ('packaging', models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='barcode_records', to='inventory.productpackaging')),
                ('generated_by', models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='generated_barcodes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'product_barcode',
                'ordering': ['-barcode_type', 'code'],
            },
        ),
        migrations.AddIndex(
            model_name='productbarcode',
            index=models.Index(fields=['organization', 'code'], name='pbc_org_code_idx'),
        ),
        migrations.AddIndex(
            model_name='productbarcode',
            index=models.Index(fields=['product', 'barcode_type'], name='pbc_product_type_idx'),
        ),
        migrations.AddConstraint(
            model_name='productbarcode',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_active', True)),
                fields=['code', 'organization'],
                name='unique_barcode_code_per_org',
            ),
        ),

        # ── Product barcode provenance fields ────────────────────────
        migrations.AddField(
            model_name='product',
            name='barcode_source',
            field=models.CharField(choices=[
                ('SUPPLIER', 'Supplier barcode'), ('INTERNAL', 'Internally generated'),
                ('MANUAL', 'Manually entered'), ('UNKNOWN', 'Unknown/legacy'),
            ], default='UNKNOWN', help_text='How this barcode was obtained', max_length=10),
        ),
        migrations.AddField(
            model_name='product',
            name='barcode_generated_at',
            field=models.DateTimeField(blank=True, null=True,
                help_text='When the barcode was auto-generated'),
        ),

        # ── ProductPackaging governance fields ───────────────────────
        migrations.AddField(
            model_name='productpackaging',
            name='is_verified',
            field=models.BooleanField(default=False,
                help_text='Package-level verification'),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='verified_by',
            field=models.ForeignKey(blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='verified_packages', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='label_printed_at',
            field=models.DateTimeField(blank=True, null=True,
                help_text='Last time a label was printed for this packaging'),
        ),
        migrations.AddField(
            model_name='productpackaging',
            name='label_version',
            field=models.PositiveIntegerField(default=0,
                help_text='Label version counter'),
        ),
    ]
