"""
Client Portal — Signals
Auto-create notifications and wallet events on order status changes.
Reads per-organization config from ClientPortalConfig.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='client_portal.ClientOrder')
def handle_client_order_status(sender, instance, created, **kwargs):
    """Auto-actions when client order status changes — uses org config."""
    if created:
        return

    from .models import ClientWallet, ClientPortalConfig

    config = ClientPortalConfig.get_config(instance.organization)

    # Auto-award loyalty on DELIVERED using org's earn rate
    if instance.status == 'DELIVERED' and config.loyalty_enabled:
        try:
            wallet, _ = ClientWallet.objects.get_or_create(
                organization=instance.organization,
                contact=instance.contact,
                defaults={'currency': config.wallet_currency},
            )
            points = config.get_points_for_amount(instance.total_amount)
            if points > 0:
                wallet.add_loyalty_points(points)
                logger.info(
                    f"Awarded {points} loyalty points to {instance.contact} "
                    f"for {instance.order_number} "
                    f"(rate: {config.loyalty_earn_rate} pts/unit)"
                )
        except Exception as e:
            logger.error(f"Failed to award loyalty: {e}")


@receiver(post_save, sender='client_portal.ClientPortalAccess')
def handle_access_activation(sender, instance, created, **kwargs):
    """Auto-create wallet when access is activated (if org config says so)."""
    if instance.status != 'ACTIVE':
        return

    from .models import ClientWallet, ClientPortalConfig

    config = ClientPortalConfig.get_config(instance.organization)

    if config.wallet_enabled and config.wallet_auto_create:
        ClientWallet.objects.get_or_create(
            organization=instance.organization,
            contact=instance.contact,
            defaults={'currency': config.wallet_currency},
        )
        logger.info(f"Auto-created wallet for {instance.contact} (currency: {config.wallet_currency})")


@receiver(post_save, sender='client_portal.ClientTicket')
def handle_ticket_creation(sender, instance, created, **kwargs):
    """Auto-assign new tickets if org config has auto-assign enabled."""
    if not created:
        return

    from .models import ClientPortalConfig

    config = ClientPortalConfig.get_config(instance.organization)

    if config.auto_assign_tickets and config.default_ticket_assignee:
        instance.assigned_to = config.default_ticket_assignee
        instance.status = 'IN_PROGRESS'
        instance.save(update_fields=['assigned_to', 'status'])
        logger.info(f"Auto-assigned ticket {instance.ticket_number} to {config.default_ticket_assignee}")
    else:
        logger.info(f"New ticket {instance.ticket_number} from {instance.contact}")
