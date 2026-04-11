"""
Migration 0026: Create Product Governance models.
- PriceChangeRequest: price approval workflow
- ProductAuditTrail: governance event log
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0025_refactor_completeness_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PriceChangeRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('current_price_ht', models.DecimalField(decimal_places=2, help_text='Current HT price at time of request', max_digits=15)),
                ('current_price_ttc', models.DecimalField(decimal_places=2, help_text='Current TTC price at time of request', max_digits=15)),
                ('proposed_price_ht', models.DecimalField(decimal_places=2, help_text='Proposed new HT price', max_digits=15)),
                ('proposed_price_ttc', models.DecimalField(decimal_places=2, help_text='Proposed new TTC price', max_digits=15)),
                ('tva_rate', models.DecimalField(decimal_places=2, default=0, help_text='TVA rate used for HT/TTC conversion', max_digits=5)),
                ('reason', models.TextField(blank=True, default='', help_text='Business justification for the price change')),
                ('change_type', models.CharField(choices=[('MANUAL', 'Manual Adjustment'), ('COST_UPDATE', 'Cost Price Update'), ('PROMOTION', 'Promotional Pricing'), ('MARKET', 'Market Realignment'), ('SUPPLIER', 'Supplier Price Change')], default='MANUAL', max_length=20)),
                ('status', models.CharField(choices=[('PENDING', 'Pending Approval'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('APPLIED', 'Applied'), ('CANCELLED', 'Cancelled')], default='PENDING', max_length=15)),
                ('review_notes', models.TextField(blank=True, default='', help_text='Notes from the reviewer (approve/reject rationale)')),
                ('effective_date', models.DateField(blank=True, help_text='When the price change should take effect (null=immediately)', null=True)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='price_change_requests', to='inventory.product')),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='price_change_requests_made', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='price_change_requests_reviewed', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'product_price_change_request',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.CreateModel(
            name='ProductAuditTrail',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event_type', models.CharField(choices=[('VERIFIED', 'Product Verified'), ('UNVERIFIED', 'Verification Removed'), ('LEVEL_CHANGE', 'Completeness Level Changed'), ('PRICE_REQUEST', 'Price Change Requested'), ('PRICE_APPROVED', 'Price Change Approved'), ('PRICE_REJECTED', 'Price Change Rejected'), ('PRICE_APPLIED', 'Price Change Applied'), ('FIELD_UPDATE', 'Product Field Updated')], max_length=20)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('details', models.JSONField(blank=True, default=dict, help_text='Structured event data (old/new values, etc.)')),
                ('organization', models.ForeignKey(blank=True, db_column='organization_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)s_set', to='erp.organization')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_trail', to='inventory.product')),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'product_audit_trail',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='pricechangerequest',
            index=models.Index(fields=['organization', 'status'], name='pcr_org_status_idx'),
        ),
        migrations.AddIndex(
            model_name='pricechangerequest',
            index=models.Index(fields=['product', 'status'], name='pcr_product_status_idx'),
        ),
        migrations.AddIndex(
            model_name='productaudittrail',
            index=models.Index(fields=['product', 'event_type'], name='pat_product_event_idx'),
        ),
        migrations.AddIndex(
            model_name='productaudittrail',
            index=models.Index(fields=['organization', 'timestamp'], name='pat_org_ts_idx'),
        ),
    ]
