"""
Migration: Harden printing center models — enterprise-grade fields.

Adds workflow metadata, rich snapshots, output artifact tracking,
versioned templates with CSS separation, printer capabilities,
source context, and tenant-scoped uniqueness.

This migration DROPS and RECREATES the 4 tables since they were just
created in 0038 and never deployed to production.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0038_print_session_models'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── DROP old tables (never deployed to prod) ─────────────────
        migrations.RemoveConstraint(
            model_name='printsessionitem',
            name='unique_product_per_session',
        ),
        migrations.RemoveIndex(
            model_name='labeltemplate',
            name='lt_org_type_idx',
        ),
        migrations.RemoveIndex(
            model_name='printsession',
            name='ps_org_status_idx',
        ),
        migrations.RemoveIndex(
            model_name='printsession',
            name='ps_org_created_idx',
        ),
        migrations.RemoveIndex(
            model_name='printsession',
            name='ps_assigned_status_idx',
        ),
        migrations.DeleteModel(name='PrintSessionItem'),
        migrations.DeleteModel(name='PrintSession'),
        migrations.DeleteModel(name='LabelTemplate'),
        migrations.DeleteModel(name='PrinterConfig'),

        # ── LabelTemplate (hardened) ─────────────────────────────────
        migrations.CreateModel(
            name='LabelTemplate',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.IntegerField(db_index=True, help_text='Tenant org ID')),
                ('name', models.CharField(help_text='Template display name', max_length=100)),
                ('label_type', models.CharField(choices=[('SHELF', 'Shelf price label'), ('BARCODE', 'Barcode sticker'), ('PACKAGING', 'Packaging label'), ('FRESH', 'Fresh/weight label'), ('CUSTOM', 'Custom template')], default='SHELF', max_length=10)),
                ('description', models.TextField(blank=True, default='')),
                ('html_template', models.TextField(blank=True, default='', help_text='HTML structure with variable placeholders')),
                ('css_template', models.TextField(blank=True, default='', help_text='CSS styling for the label layout')),
                ('variables_schema', models.JSONField(blank=True, default=list, help_text='List of allowed variable names')),
                ('version', models.PositiveIntegerField(default=1)),
                ('template_schema_version', models.CharField(default='1.0', max_length=10)),
                ('is_system', models.BooleanField(default=False)),
                ('is_default', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('label_width_mm', models.DecimalField(decimal_places=2, default=50, max_digits=8)),
                ('label_height_mm', models.DecimalField(decimal_places=2, default=30, max_digits=8)),
                ('orientation', models.CharField(choices=[('PORTRAIT', 'Portrait'), ('LANDSCAPE', 'Landscape')], default='LANDSCAPE', max_length=10)),
                ('dpi', models.PositiveIntegerField(default=203)),
                ('columns', models.PositiveIntegerField(default=3)),
                ('rows', models.PositiveIntegerField(default=10)),
                ('gap_horizontal_mm', models.DecimalField(decimal_places=2, default=2, max_digits=6)),
                ('gap_vertical_mm', models.DecimalField(decimal_places=2, default=2, max_digits=6)),
                ('margin_top_mm', models.DecimalField(decimal_places=2, default=5, max_digits=6)),
                ('margin_right_mm', models.DecimalField(decimal_places=2, default=5, max_digits=6)),
                ('margin_bottom_mm', models.DecimalField(decimal_places=2, default=5, max_digits=6)),
                ('margin_left_mm', models.DecimalField(decimal_places=2, default=5, max_digits=6)),
                ('supports_barcode', models.BooleanField(default=True)),
                ('supports_qr', models.BooleanField(default=False)),
                ('default_font_size', models.PositiveIntegerField(default=12)),
                ('preview_image', models.CharField(blank=True, default='', max_length=500)),
            ],
            options={'db_table': 'label_template', 'ordering': ['label_type', 'name']},
        ),
        migrations.AddIndex(model_name='labeltemplate', index=models.Index(fields=['organization', 'label_type'], name='lt_org_type_idx')),
        migrations.AddConstraint(model_name='labeltemplate', constraint=models.UniqueConstraint(fields=('organization', 'name', 'label_type'), name='unique_template_name_per_org_type')),

        # ── PrinterConfig (hardened) ─────────────────────────────────
        migrations.CreateModel(
            name='PrinterConfig',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.IntegerField(db_index=True, help_text='Tenant org ID')),
                ('name', models.CharField(help_text='Printer display name', max_length=100)),
                ('device_identifier', models.CharField(blank=True, default='', max_length=200)),
                ('model_name', models.CharField(blank=True, default='', max_length=100)),
                ('location', models.CharField(blank=True, default='', max_length=200)),
                ('printer_type', models.CharField(choices=[('THERMAL', 'Thermal printer'), ('INKJET', 'Inkjet printer'), ('LASER', 'Laser printer')], default='THERMAL', max_length=10)),
                ('connection_type', models.CharField(choices=[('USB', 'USB direct'), ('NETWORK', 'Network / IP'), ('BLUETOOTH', 'Bluetooth')], default='NETWORK', max_length=10)),
                ('address', models.CharField(blank=True, default='', max_length=255)),
                ('dpi', models.PositiveIntegerField(default=203)),
                ('paper_width_mm', models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ('driver_name', models.CharField(blank=True, default='', max_length=100)),
                ('supports_pdf', models.BooleanField(default=True)),
                ('supports_zpl', models.BooleanField(default=False)),
                ('supports_epl', models.BooleanField(default=False)),
                ('supports_escpos', models.BooleanField(default=False)),
                ('supported_label_types', models.JSONField(blank=True, default=list)),
                ('is_default', models.BooleanField(default=False)),
                ('default_label_type', models.CharField(blank=True, default='', max_length=10)),
                ('is_active', models.BooleanField(default=True)),
                ('last_seen_at', models.DateTimeField(blank=True, null=True)),
                ('last_tested_at', models.DateTimeField(blank=True, null=True)),
                ('test_status', models.CharField(blank=True, default='', max_length=20)),
                ('test_message', models.TextField(blank=True, default='')),
            ],
            options={'db_table': 'printer_config', 'ordering': ['-is_default', 'name']},
        ),
        migrations.AddConstraint(model_name='printerconfig', constraint=models.UniqueConstraint(fields=('organization', 'name'), name='unique_printer_name_per_org')),

        # ── PrintSession (hardened) ──────────────────────────────────
        migrations.CreateModel(
            name='PrintSession',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.IntegerField(db_index=True, help_text='Tenant org ID')),
                ('session_code', models.CharField(editable=False, max_length=30)),
                ('title', models.CharField(blank=True, default='', max_length=200)),
                ('label_type', models.CharField(choices=[('SHELF', 'Shelf price labels'), ('BARCODE', 'Barcode stickers'), ('PACKAGING', 'Packaging labels'), ('FRESH', 'Fresh/weight labels'), ('CUSTOM', 'Custom labels')], default='SHELF', max_length=10)),
                ('status', models.CharField(choices=[('DRAFT', 'Draft'), ('APPROVED', 'Approved'), ('QUEUED', 'Queued'), ('PRINTING', 'Printing'), ('COMPLETED', 'Completed'), ('FAILED', 'Failed'), ('CANCELLED', 'Cancelled')], default='DRAFT', max_length=15)),
                ('trigger', models.CharField(choices=[('MANUAL', 'Manually created'), ('PURCHASE', 'Auto - purchased'), ('TRANSFER', 'Auto - transfer'), ('PRICE_CHANGE', 'Auto - price changed'), ('BARCODE_GEN', 'Auto - barcode generated'), ('NEW_PRODUCT', 'Auto - new product')], default='MANUAL', max_length=15)),
                ('source_context', models.CharField(choices=[('PRODUCT_LIST', 'Product listing'), ('RECEIVING', 'Goods receiving'), ('STOCK_COUNT', 'Stock count'), ('STOCK_TRANSFER', 'Stock transfer'), ('PACKAGING', 'Packaging change'), ('PRICE_UPDATE', 'Price update'), ('BARCODE_GEN', 'Barcode generation'), ('SCHEDULER', 'Scheduled')], default='PRODUCT_LIST', max_length=20)),
                ('output_method', models.CharField(choices=[('PDF', 'PDF export'), ('THERMAL', 'Direct thermal'), ('BROWSER', 'Browser print')], default='PDF', max_length=10)),
                ('copies', models.PositiveIntegerField(default=1)),
                ('is_reprint', models.BooleanField(default=False)),
                ('reprint_mode', models.CharField(blank=True, choices=[('EXACT', 'Exact from snapshot'), ('REGENERATE', 'From live data')], default='', max_length=12)),
                ('queued_at', models.DateTimeField(blank=True, null=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                ('failure_reason', models.TextField(blank=True, default='')),
                ('notes', models.TextField(blank=True, default='')),
                ('output_path', models.CharField(blank=True, default='', max_length=500)),
                ('output_checksum', models.CharField(blank=True, default='', max_length=64)),
                ('page_count', models.PositiveIntegerField(default=0)),
                ('render_context_hash', models.CharField(blank=True, default='', max_length=64)),
                ('job_reference', models.CharField(blank=True, default='', max_length=100)),
                ('total_products', models.PositiveIntegerField(default=0)),
                ('total_labels', models.PositiveIntegerField(default=0)),
                ('template', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='print_sessions', to='inventory.labeltemplate')),
                ('printer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='print_sessions', to='inventory.printerconfig')),
                ('original_session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reprints', to='inventory.printsession')),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_print_sessions', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_print_sessions', to=settings.AUTH_USER_MODEL)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_print_sessions', to=settings.AUTH_USER_MODEL)),
                ('cancelled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cancelled_print_sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'print_session', 'ordering': ['-created_at']},
        ),
        migrations.AddIndex(model_name='printsession', index=models.Index(fields=['organization', 'status'], name='ps_org_status_idx')),
        migrations.AddIndex(model_name='printsession', index=models.Index(fields=['organization', 'created_at'], name='ps_org_created_idx')),
        migrations.AddIndex(model_name='printsession', index=models.Index(fields=['assigned_to', 'status'], name='ps_assigned_status_idx')),
        migrations.AddConstraint(model_name='printsession', constraint=models.UniqueConstraint(fields=('organization', 'session_code'), name='unique_session_code_per_org')),

        # ── PrintSessionItem (hardened) ──────────────────────────────
        migrations.CreateModel(
            name='PrintSessionItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.IntegerField(db_index=True, help_text='Tenant org ID')),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('snapshot_name', models.CharField(blank=True, default='', max_length=255)),
                ('snapshot_sku', models.CharField(blank=True, default='', max_length=100)),
                ('snapshot_barcode', models.CharField(blank=True, default='', max_length=100)),
                ('snapshot_price', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('snapshot_category', models.CharField(blank=True, default='', max_length=200)),
                ('snapshot_supplier', models.CharField(blank=True, default='', max_length=200)),
                ('snapshot_unit', models.CharField(blank=True, default='', max_length=50)),
                ('snapshot_currency', models.CharField(blank=True, default='', max_length=10)),
                ('snapshot_product_ref', models.CharField(blank=True, default='', max_length=100)),
                ('snapshot_tax_mode', models.CharField(blank=True, default='TTC', max_length=5)),
                ('snapshot_packaging_name', models.CharField(blank=True, default='', max_length=200)),
                ('snapshot_packaging_barcode', models.CharField(blank=True, default='', max_length=100)),
                ('snapshot_packaging_ratio', models.DecimalField(blank=True, decimal_places=4, max_digits=10, null=True)),
                ('snapshot_variant_summary', models.CharField(blank=True, default='', max_length=300)),
                ('snapshot_template_version', models.PositiveIntegerField(default=1)),
                ('is_printed', models.BooleanField(default=False)),
                ('printed_at', models.DateTimeField(blank=True, null=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.printsession')),
                ('product', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='print_queue_items', to='inventory.product')),
            ],
            options={'db_table': 'print_session_item', 'ordering': ['id']},
        ),
        migrations.AddConstraint(model_name='printsessionitem', constraint=models.UniqueConstraint(condition=models.Q(('product__isnull', False)), fields=('session', 'product'), name='unique_product_per_session')),
    ]
