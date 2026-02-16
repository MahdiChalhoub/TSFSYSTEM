"""
Finance Module Signals
======================
Event-driven signal handlers for payment lifecycle and balance updates.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender='finance.Payment')
def handle_payment_posted(sender, instance, **kwargs):
    """
    Fires when a Payment is saved.
    - POSTED + SUPPLIER_PAYMENT + REAL company type → trigger cash-basis VAT release
    """
    if instance.status != 'POSTED':
        return

    if instance.type == 'SUPPLIER_PAYMENT':
        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(instance.organization)
            company_type = settings.get('companyType', 'REGULAR')
            declare_tva = settings.get('declareTVA', False)

            if company_type == 'REAL' and declare_tva:
                from apps.finance.payment_service import PaymentService
                PaymentService.release_vat_on_payment(
                    organization=instance.organization,
                    payment=instance
                )
                logger.info(f"[SIGNAL] Cash-basis VAT released for payment #{instance.id}")
        except Exception as e:
            logger.error(f"[SIGNAL] Failed cash-basis VAT release: {e}")

    elif instance.type == 'CUSTOMER_RECEIPT':
        logger.info(f"[SIGNAL] Customer receipt #{instance.id} posted — balance updated by service")
