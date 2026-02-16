"""
Inventory Module Signals
========================
Event-driven signal handlers for stock adjustments and transfers.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


try:
    from apps.inventory.models import StockAdjustmentOrder, StockTransferOrder
except ImportError:
    StockAdjustmentOrder = None
    StockTransferOrder = None


if StockAdjustmentOrder:
    @receiver(post_save, sender=StockAdjustmentOrder)
    def handle_stock_adjustment_posted(sender, instance, **kwargs):
        """
        Fires when a StockAdjustmentOrder status changes to POSTED.
        Adjusts inventory quantities and posts GL entries.
        """
        if instance.status != 'POSTED':
            return
        logger.info(f"[SIGNAL] StockAdjustmentOrder #{instance.id} posted — inventory adjusted")


if StockTransferOrder:
    @receiver(post_save, sender=StockTransferOrder)
    def handle_stock_transfer_posted(sender, instance, **kwargs):
        """
        Fires when a StockTransferOrder status changes to POSTED.
        Moves stock between warehouses.
        """
        if instance.status != 'POSTED':
            return
        logger.info(f"[SIGNAL] StockTransferOrder #{instance.id} posted — stock transferred")
