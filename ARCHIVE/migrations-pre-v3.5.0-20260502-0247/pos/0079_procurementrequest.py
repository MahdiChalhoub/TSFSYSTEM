"""
Bring `procurement_request` table into Django's migration registry.

The table existed in the live DB before Django's migration history started
tracking it (the model was hand-written without an initial CreateModel
migration). This migration uses `SeparateDatabaseAndState`:

  - state_operations: register the full model in Django's state graph so
    future migrations against this model resolve cleanly.
  - database_operations: only add the two new columns (`last_bumped_at`,
    `bump_count`) — the rest of the table already exists.
"""
import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


CREATE_MODEL_STATE = migrations.CreateModel(
    name='ProcurementRequest',
    fields=[
        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        ('request_type', models.CharField(choices=[('TRANSFER', 'Internal Transfer'), ('PURCHASE', 'Purchase from Supplier')], max_length=20)),
        ('status', models.CharField(choices=[('PENDING', 'Pending Review'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('EXECUTED', 'Executed'), ('CANCELLED', 'Cancelled')], default='PENDING', max_length=20)),
        ('priority', models.CharField(choices=[('LOW', 'Low'), ('NORMAL', 'Normal'), ('HIGH', 'High'), ('URGENT', 'Urgent')], default='NORMAL', max_length=10)),
        ('quantity', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=15)),
        ('suggested_unit_price', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
        ('reason', models.TextField(blank=True, null=True)),
        ('notes', models.TextField(blank=True, null=True)),
        ('requested_at', models.DateTimeField(auto_now_add=True)),
        ('reviewed_at', models.DateTimeField(blank=True, null=True)),
        ('last_bumped_at', models.DateTimeField(blank=True, null=True)),
        ('bump_count', models.PositiveIntegerField(default=0)),
        ('from_warehouse', models.ForeignKey(blank=True, help_text='Source warehouse (for transfers)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='outgoing_requests', to='inventory.warehouse')),
        ('organization', models.ForeignKey(db_column='tenant_id', on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
        ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='procurement_requests', to='inventory.product')),
        ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='procurement_requests_created', to=settings.AUTH_USER_MODEL)),
        ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='procurement_requests_reviewed', to=settings.AUTH_USER_MODEL)),
        ('source_po', models.ForeignKey(blank=True, help_text='The PO being created when this request was generated', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='derived_requests', to='pos.purchaseorder')),
        ('supplier', models.ForeignKey(blank=True, limit_choices_to={'type': 'SUPPLIER'}, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='purchase_requests', to='crm.contact')),
        ('to_warehouse', models.ForeignKey(blank=True, help_text='Destination warehouse (for transfers)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='incoming_requests', to='inventory.warehouse')),
    ],
    options={
        'db_table': 'procurement_request',
        'ordering': ['-requested_at'],
        'indexes': [
            models.Index(fields=['organization', 'status'], name='procurement_tenant__b53807_idx'),
            models.Index(fields=['organization', 'request_type'], name='procurement_tenant__d6b670_idx'),
        ],
    },
)


# Idempotently add the two new columns to the existing table. Safe to re-run.
ADD_COLUMNS_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='procurement_request' AND column_name='last_bumped_at'
    ) THEN
        ALTER TABLE procurement_request ADD COLUMN last_bumped_at timestamptz NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='procurement_request' AND column_name='bump_count'
    ) THEN
        ALTER TABLE procurement_request ADD COLUMN bump_count integer NOT NULL DEFAULT 0;
    END IF;
END $$;
"""

REMOVE_COLUMNS_SQL = """
ALTER TABLE procurement_request DROP COLUMN IF EXISTS bump_count;
ALTER TABLE procurement_request DROP COLUMN IF EXISTS last_bumped_at;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0024_contact_wallet_balance'),
        ('erp', '0028_remove_approvalrule_organization_and_more'),
        ('inventory', '0066_rename_pkg_sug_org_cat_idx_packaging_s_tenant__ed4449_idx_and_more'),
        ('pos', '0078_driver_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Register the model in Django's migration state without touching the
        # existing table; then ALTER only for the two new columns.
        migrations.SeparateDatabaseAndState(
            state_operations=[CREATE_MODEL_STATE],
            database_operations=[migrations.RunSQL(ADD_COLUMNS_SQL, reverse_sql=REMOVE_COLUMNS_SQL)],
        ),
    ]
