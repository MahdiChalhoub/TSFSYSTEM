# Generated manually for Phase 1: Rename ORDERED → SENT

from django.db import migrations


def rename_ordered_to_sent(apps, schema_editor):
    """Update existing PurchaseOrder rows from ORDERED to SENT."""
    PurchaseOrder = apps.get_model('pos', 'PurchaseOrder')
    updated = PurchaseOrder.objects.filter(status='ORDERED').update(status='SENT')
    if updated:
        print(f"  → Migrated {updated} PurchaseOrder(s) from ORDERED → SENT")


def reverse_sent_to_ordered(apps, schema_editor):
    """Rollback: Rename SENT back to ORDERED."""
    PurchaseOrder = apps.get_model('pos', 'PurchaseOrder')
    PurchaseOrder.objects.filter(status='SENT').update(status='ORDERED')


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0044_gap10_generated_document'),
    ]

    operations = [
        # 1. Update the field choices (schema change)
        migrations.AlterField(
            model_name='purchaseorder',
            name='status',
            field=__import__('django.db.models', fromlist=['CharField']).CharField(
                choices=[
                    ('DRAFT', 'Draft'),
                    ('SUBMITTED', 'Submitted for Approval'),
                    ('APPROVED', 'Approved'),
                    ('REJECTED', 'Rejected'),
                    ('SENT', 'Sent to Supplier'),
                    ('CONFIRMED', 'Confirmed by Supplier'),
                    ('IN_TRANSIT', 'In Transit / Dispatched'),
                    ('PARTIALLY_RECEIVED', 'Partially Received'),
                    ('RECEIVED', 'Fully Received'),
                    ('INVOICED', 'Invoiced'),
                    ('COMPLETED', 'Completed'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='DRAFT',
                max_length=25,
            ),
        ),
        # 2. Data migration: rename existing rows
        migrations.RunPython(
            rename_ordered_to_sent,
            reverse_sent_to_ordered,
        ),
    ]
