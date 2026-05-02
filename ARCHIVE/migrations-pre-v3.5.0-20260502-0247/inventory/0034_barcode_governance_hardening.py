"""
Manual migration: Barcode Governance Hardening (Phases 1-4)

Creates:
- barcode_change_request table (BarcodeChangeRequest)

Alters:
- product_barcode: TYPE_CHOICES updated, two new unique constraints
- barcode_policy: adds prefix_max_length, prefix_lock_after_generation fields
- product_audit_trail: event_type max_length 20→25
- label_record: adds reprint_reason_detail, old_labels_invalidated, shelf_relabel_pending
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0033_country_isolation'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── 1. Create BarcodeChangeRequest table ──
        migrations.CreateModel(
            name='BarcodeChangeRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('current_barcode', models.CharField(help_text='Current barcode at time of request', max_length=100)),
                ('proposed_barcode', models.CharField(help_text='Proposed new barcode', max_length=100)),
                ('reason', models.TextField(blank=True, default='', help_text='Business justification for the barcode change')),
                ('change_type', models.CharField(choices=[
                    ('MANUAL', 'Manual Change'),
                    ('SUPPLIER_UPDATE', 'Supplier Barcode Update'),
                    ('FORMAT_MIGRATION', 'Format Migration (e.g. EAN-8 → EAN-13)'),
                    ('RECALL', 'Product Recall / Safety'),
                    ('CORRECTION', 'Data Correction'),
                ], default='MANUAL', max_length=20)),
                ('status', models.CharField(choices=[
                    ('PENDING', 'Pending Approval'),
                    ('APPROVED', 'Approved'),
                    ('REJECTED', 'Rejected'),
                    ('APPLIED', 'Applied'),
                    ('CANCELLED', 'Cancelled'),
                ], default='PENDING', max_length=15)),
                ('review_notes', models.TextField(blank=True, default='', help_text='Notes from the reviewer')),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='barcode_change_requests', to='inventory.product')),
                ('packaging', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='barcode_change_requests', to='inventory.productpackaging')),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='barcode_change_requests_made', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='barcode_change_requests_reviewed', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'barcode_change_request',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.AddIndex(
            model_name='barcodechangerequest',
            index=models.Index(fields=['organization', 'status'], name='bcr_org_status_idx'),
        ),
        migrations.AddIndex(
            model_name='barcodechangerequest',
            index=models.Index(fields=['product', 'status'], name='bcr_product_status_idx'),
        ),

        # ── 2. ProductBarcode: add one-primary constraints ──
        migrations.AddConstraint(
            model_name='productbarcode',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_active=True, barcode_type='PRIMARY', packaging__isnull=True),
                fields=['product', 'organization'],
                name='one_primary_barcode_per_product',
            ),
        ),
        migrations.AddConstraint(
            model_name='productbarcode',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_active=True, barcode_type='PRIMARY', packaging__isnull=False),
                fields=['packaging', 'organization'],
                name='one_primary_barcode_per_packaging',
            ),
        ),

        # ── 3. BarcodePolicy: add prefix governance fields ──
        migrations.AddField(
            model_name='barcodepolicy',
            name='prefix_max_length',
            field=models.PositiveSmallIntegerField(default=3, help_text='Max digits from category code used in barcode prefix'),
        ),
        migrations.AddField(
            model_name='barcodepolicy',
            name='prefix_lock_after_generation',
            field=models.BooleanField(default=True, help_text='Prevent category code change if barcodes were already generated under it'),
        ),

        # ── 4. ProductAuditTrail: widen event_type for namespaced events ──
        migrations.AlterField(
            model_name='productaudittrail',
            name='event_type',
            field=models.CharField(max_length=25, choices=[
                ('PROD_VERIFIED', 'Product Verified'),
                ('PROD_UNVERIFIED', 'Verification Removed'),
                ('PROD_LEVEL_CHANGE', 'Completeness Level Changed'),
                ('PROD_FIELD_UPDATE', 'Product Field Updated'),
                ('PRICE_REQUEST', 'Price Change Requested'),
                ('PRICE_APPROVED', 'Price Change Approved'),
                ('PRICE_REJECTED', 'Price Change Rejected'),
                ('PRICE_APPLIED', 'Price Change Applied'),
                ('BC_GENERATED', 'Barcode Generated'),
                ('BC_CHANGED', 'Barcode Changed'),
                ('BC_RETIRED', 'Barcode Retired'),
                ('BC_CHANGE_REQUESTED', 'Barcode Change Requested'),
                ('BC_CHANGE_APPROVED', 'Barcode Change Approved'),
                ('BC_CHANGE_REJECTED', 'Barcode Change Rejected'),
                ('PKG_CREATED', 'Packaging Created'),
                ('PKG_UPDATED', 'Packaging Updated'),
                ('PKG_DELETED', 'Packaging Deleted'),
                ('PKG_VERIFIED', 'Packaging Verified'),
                ('PKG_UNVERIFIED', 'Packaging Unverified'),
                ('PKG_BARCODE_CHANGED', 'Package Barcode Changed'),
                ('LABEL_PRINTED', 'Label Printed'),
                ('LABEL_INVALIDATED', 'Label Invalidated'),
                ('LABEL_RELABEL_DONE', 'Shelf Relabeled'),
                ('SUPPLIER_LINKED', 'Supplier Linked'),
                ('SUPPLIER_REMOVED', 'Supplier Removed'),
            ]),
        ),

        # ── 5. LabelRecord: add reprint governance fields ──
        migrations.AddField(
            model_name='labelrecord',
            name='reprint_reason_detail',
            field=models.TextField(blank=True, default='', help_text='Detailed explanation for why reprint was needed'),
        ),
        migrations.AddField(
            model_name='labelrecord',
            name='old_labels_invalidated',
            field=models.BooleanField(default=False, help_text='Whether previous labels were formally invalidated'),
        ),
        migrations.AddField(
            model_name='labelrecord',
            name='shelf_relabel_pending',
            field=models.BooleanField(default=False, help_text='Physical shelf replacement still needed'),
        ),
    ]
