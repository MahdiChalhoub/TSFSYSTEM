"""
Migration: Print session models for the Printing Center.

Creates:
- label_template — reusable HTML label layouts with paper/size config
- printer_config — thermal/network printer hardware settings
- print_session — batch session for label printing queue
- print_session_item — individual product in a print session
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0037_barcode_governance_permissions'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── LabelTemplate ──────────────────────────────────────────────
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
                ('html_template', models.TextField(blank=True, default='', help_text='HTML content with {name}, {price}, {barcode}, {sku}, {note} variables')),
                ('paper_width_mm', models.DecimalField(decimal_places=2, default=50, help_text='Label width in millimeters', max_digits=8)),
                ('paper_height_mm', models.DecimalField(decimal_places=2, default=30, help_text='Label height in millimeters', max_digits=8)),
                ('margin_top_mm', models.DecimalField(decimal_places=2, default=2, max_digits=6)),
                ('margin_right_mm', models.DecimalField(decimal_places=2, default=2, max_digits=6)),
                ('margin_bottom_mm', models.DecimalField(decimal_places=2, default=2, max_digits=6)),
                ('margin_left_mm', models.DecimalField(decimal_places=2, default=2, max_digits=6)),
                ('columns_per_page', models.PositiveIntegerField(default=3, help_text='Number of labels per row on a page')),
                ('rows_per_page', models.PositiveIntegerField(default=10, help_text='Number of label rows per page')),
                ('is_default', models.BooleanField(default=False, help_text='Default template for its label type')),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'db_table': 'label_template',
                'ordering': ['label_type', 'name'],
            },
        ),
        migrations.AddIndex(
            model_name='labeltemplate',
            index=models.Index(fields=['organization', 'label_type'], name='lt_org_type_idx'),
        ),

        # ── PrinterConfig ──────────────────────────────────────────────
        migrations.CreateModel(
            name='PrinterConfig',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.IntegerField(db_index=True, help_text='Tenant org ID')),
                ('name', models.CharField(help_text='Printer display name', max_length=100)),
                ('printer_type', models.CharField(choices=[('THERMAL', 'Thermal printer'), ('INKJET', 'Inkjet printer'), ('LASER', 'Laser printer')], default='THERMAL', max_length=10)),
                ('connection_type', models.CharField(choices=[('USB', 'USB direct'), ('NETWORK', 'Network / IP'), ('BLUETOOTH', 'Bluetooth')], default='NETWORK', max_length=10)),
                ('address', models.CharField(blank=True, default='', help_text='IP address, USB port, or Bluetooth address', max_length=255)),
                ('model_name', models.CharField(blank=True, default='', help_text='Printer model (e.g. Zebra ZD421, Brother QL-820)', max_length=100)),
                ('dpi', models.PositiveIntegerField(default=203, help_text='Print resolution (dots per inch)')),
                ('is_default', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('last_tested_at', models.DateTimeField(blank=True, null=True)),
                ('last_test_result', models.CharField(blank=True, default='', help_text='PASS, FAIL, or blank', max_length=20)),
            ],
            options={
                'db_table': 'printer_config',
                'ordering': ['-is_default', 'name'],
            },
        ),

        # ── PrintSession ───────────────────────────────────────────────
        migrations.CreateModel(
            name='PrintSession',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.IntegerField(db_index=True, help_text='Tenant org ID')),
                ('session_code', models.CharField(editable=False, help_text='Auto-generated session code (e.g. PRINT-001)', max_length=30)),
                ('title', models.CharField(blank=True, default='', help_text='Optional session title/description', max_length=200)),
                ('label_type', models.CharField(choices=[('SHELF', 'Shelf price labels'), ('BARCODE', 'Barcode stickers'), ('PACKAGING', 'Packaging labels'), ('FRESH', 'Fresh/weight labels'), ('CUSTOM', 'Custom labels')], default='SHELF', max_length=10)),
                ('status', models.CharField(choices=[('DRAFT', 'Draft - still selecting products'), ('QUEUED', 'Queued - ready to print'), ('PRINTING', 'Printing in progress'), ('COMPLETED', 'Completed'), ('FAILED', 'Failed'), ('CANCELLED', 'Cancelled')], default='DRAFT', max_length=15)),
                ('trigger', models.CharField(choices=[('MANUAL', 'Manually created'), ('PURCHASE', 'Auto - product purchased'), ('TRANSFER', 'Auto - stock transfer'), ('PRICE_CHANGE', 'Auto - price changed'), ('BARCODE_GEN', 'Auto - barcode generated'), ('NEW_PRODUCT', 'Auto - new product created')], default='MANUAL', help_text='What triggered this session creation', max_length=15)),
                ('output_method', models.CharField(choices=[('PDF', 'PDF export'), ('THERMAL', 'Direct to thermal printer'), ('BROWSER', 'Browser print dialog')], default='PDF', max_length=10)),
                ('queued_at', models.DateTimeField(blank=True, null=True)),
                ('printing_started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('total_products', models.PositiveIntegerField(default=0)),
                ('total_labels', models.PositiveIntegerField(default=0)),
                ('template', models.ForeignKey(blank=True, help_text='Layout template used for this session', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='print_sessions', to='inventory.labeltemplate')),
                ('printer', models.ForeignKey(blank=True, help_text='Target printer (for THERMAL output)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='print_sessions', to='inventory.printerconfig')),
                ('assigned_to', models.ForeignKey(blank=True, help_text='Person responsible for printing', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_print_sessions', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_print_sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'print_session',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='printsession',
            index=models.Index(fields=['organization', 'status'], name='ps_org_status_idx'),
        ),
        migrations.AddIndex(
            model_name='printsession',
            index=models.Index(fields=['organization', 'created_at'], name='ps_org_created_idx'),
        ),
        migrations.AddIndex(
            model_name='printsession',
            index=models.Index(fields=['assigned_to', 'status'], name='ps_assigned_status_idx'),
        ),

        # ── PrintSessionItem ──────────────────────────────────────────
        migrations.CreateModel(
            name='PrintSessionItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.IntegerField(db_index=True, help_text='Tenant org ID')),
                ('quantity', models.PositiveIntegerField(default=1, help_text='Number of labels to print for this product')),
                ('snapshot_name', models.CharField(blank=True, default='', max_length=255)),
                ('snapshot_sku', models.CharField(blank=True, default='', max_length=100)),
                ('snapshot_barcode', models.CharField(blank=True, default='', max_length=100)),
                ('snapshot_price', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('snapshot_category', models.CharField(blank=True, default='', max_length=200)),
                ('snapshot_supplier', models.CharField(blank=True, default='', max_length=200)),
                ('is_printed', models.BooleanField(default=False)),
                ('printed_at', models.DateTimeField(blank=True, null=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.printsession')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='print_queue_items', to='inventory.product')),
            ],
            options={
                'db_table': 'print_session_item',
                'ordering': ['id'],
            },
        ),
        migrations.AddConstraint(
            model_name='printsessionitem',
            constraint=models.UniqueConstraint(fields=('session', 'product'), name='unique_product_per_session'),
        ),
    ]
