import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.inventory.models import Inventory
from .models import ExternalProductMapping
from .sync_service import EcommerceSyncService

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Inventory)
def push_inventory_to_ecommerce(sender, instance, **kwargs):
    """
    Automatically push inventory updates to connected e-commerce stores 
    whenever the local Inventory record is saved.
    """
    product = instance.product
    # Find all active integrations that have this product mapped
    mappings = ExternalProductMapping.objects.filter(
        product=product, 
        integration__is_active=True
    ).select_related('integration')
    
    for mapping in mappings:
        try:
            service = EcommerceSyncService(mapping.integration)
            service.push_inventory(product)
        except Exception as e:
            # log the error but don't fail the primary inventory save operation
            logger.error(f"Auto-sync failed for {product.sku} on {mapping.integration.platform}: {e}")
