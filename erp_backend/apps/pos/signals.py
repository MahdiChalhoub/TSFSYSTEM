"""
POS Module Signals
==================
Event-driven signal handlers for sales and returns lifecycle.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender='pos.Order')
def handle_order_status_change(sender, instance, **kwargs):
    """
    Fires when an Order is saved. Handles lifecycle transitions:
    - SALE + COMPLETED → Log sale finalization
    - PURCHASE + COMPLETED → Update supplier balance
    """
    if not instance.pk:
        return

    if instance.type == 'SALE' and instance.status == 'COMPLETED':
        logger.info(f"[SIGNAL] Sale #{instance.id} finalized for org {instance.organization_id}")

    elif instance.type == 'PURCHASE' and instance.status == 'COMPLETED':
        try:
            from apps.finance.payment_models import SupplierBalance
            if instance.contact_id:
                balance, _ = SupplierBalance.objects.get_or_create(
                    organization=instance.organization,
                    contact_id=instance.contact_id,
                    defaults={'current_balance': 0}
                )
                balance.current_balance += instance.total_amount
                balance.last_invoice_date = instance.created_at.date() if instance.created_at else None
                balance.save()
                logger.info(f"[SIGNAL] Supplier balance updated for contact {instance.contact_id}: +{instance.total_amount}")
        except Exception as e:
            logger.error(f"[SIGNAL] Failed to update supplier balance: {e}")


@receiver(post_save, sender='pos.SalesReturn')
def handle_sales_return_status_change(sender, instance, **kwargs):
    """
    Fires when a SalesReturn status changes.
    - APPROVED → Log credit note creation
    - COMPLETED → Log final settlement
    """
    if instance.status == 'APPROVED':
        logger.info(f"[SIGNAL] SalesReturn #{instance.id} approved — CreditNote created")
    elif instance.status == 'COMPLETED':
        logger.info(f"[SIGNAL] SalesReturn #{instance.id} completed")


@receiver(post_save, sender='pos.PurchaseReturn')
def handle_purchase_return_status_change(sender, instance, **kwargs):
    """
    Fires when a PurchaseReturn status changes.
    - COMPLETED → Reduce supplier balance
    """
    if instance.status == 'COMPLETED':
        try:
            from apps.finance.payment_models import SupplierBalance
            if instance.supplier_id:
                total_return = sum(
                    line.total_amount for line in instance.lines.all()
                )
                balance, _ = SupplierBalance.objects.get_or_create(
                    organization=instance.organization,
                    contact_id=instance.supplier_id,
                    defaults={'current_balance': 0}
                )
                balance.current_balance -= total_return
                balance.save()
                logger.info(f"[SIGNAL] Supplier balance reduced by {total_return} for purchase return #{instance.id}")
        except Exception as e:
            logger.error(f"[SIGNAL] Failed to update supplier balance on return: {e}")
