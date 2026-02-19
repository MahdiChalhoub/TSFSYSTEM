"""
Client Portal — Signals
Auto-create notifications and wallet events on order status changes.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='client_portal.ClientOrder')
def handle_client_order_status(sender, instance, created, **kwargs):
    """Auto-actions when client order status changes."""
    if created:
        return

    from .models import ClientWallet

    # Auto-create wallet on first DELIVERED order and award loyalty
    if instance.status == 'DELIVERED':
        try:
            wallet, _ = ClientWallet.objects.get_or_create(
                organization=instance.organization,
                contact=instance.contact,
            )
            # Award loyalty: 1 point per currency unit spent
            points = int(instance.total_amount)
            if points > 0:
                wallet.add_loyalty_points(points)
                logger.info(f"Awarded {points} loyalty points to {instance.contact} for {instance.order_number}")
        except Exception as e:
            logger.error(f"Failed to award loyalty: {e}")


@receiver(post_save, sender='client_portal.ClientTicket')
def handle_ticket_status(sender, instance, created, **kwargs):
    """Log ticket status changes."""
    if created:
        logger.info(f"New ticket {instance.ticket_number} from {instance.contact}")
    elif instance.status == 'RESOLVED':
        logger.info(f"Ticket {instance.ticket_number} resolved")
