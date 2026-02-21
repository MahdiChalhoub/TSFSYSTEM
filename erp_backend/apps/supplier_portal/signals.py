"""
Supplier Portal — Signals
Auto-create notifications when PO status changes or proforma status changes.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='supplier_portal.SupplierProforma')
def notify_proforma_status_change(sender, instance, created, **kwargs):
    """Create a supplier notification when proforma status changes."""
    if created:
        return  # Skip on creation

    from .models import SupplierNotification

    status_messages = {
        'UNDER_REVIEW': 'Your proforma is now under review.',
        'APPROVED': 'Your proforma has been approved!',
        'REJECTED': f'Your proforma was rejected. Reason: {instance.rejection_reason or "Not specified"}',
        'NEGOTIATING': f'A counter-proposal was made: {instance.negotiation_notes or "See details"}',
        'CONVERTED': f'Your proforma was converted to PO.',
    }

    msg = status_messages.get(instance.status)
    if msg:
        try:
            SupplierNotification.objects.create(
                organization=instance.organization,
                supplier=instance.supplier,
                notification_type='PROFORMA_STATUS',
                title=f'Proforma {instance.proforma_number}: {instance.get_status_display()}',
                message=msg,
                related_object_type='SupplierProforma',
                related_object_id=instance.id,
            )
        except Exception as e:
            logger.error(f"Failed to create proforma notification: {e}")


def notify_po_status_to_supplier(po_instance):
    """
    Call this from PO lifecycle hooks to notify linked suppliers.
    Public API for other modules.
    """
    from .models import SupplierNotification, SupplierPortalAccess

    try:
        # Check if this supplier has portal access
        if not hasattr(po_instance.supplier, 'portal_access'):
            return
        access = po_instance.supplier.portal_access
        if access.status != 'ACTIVE':
            return

        SupplierNotification.objects.create(
            organization=po_instance.organization,
            supplier=po_instance.supplier,
            notification_type='ORDER_UPDATE',
            title=f'Order {po_instance.po_number}: {po_instance.get_status_display()}',
            message=f'Your purchase order {po_instance.po_number} status changed to {po_instance.get_status_display()}.',
            related_object_type='PurchaseOrder',
            related_object_id=po_instance.id,
        )
    except Exception as e:
        logger.error(f"Failed to notify supplier about PO: {e}")
