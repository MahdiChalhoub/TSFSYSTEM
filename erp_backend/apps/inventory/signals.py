"""
Inventory Module Signals
========================
Event-driven signal handlers for stock adjustments, transfers,
product creation, and price changes.

Wires into the Auto-Tasking Engine for automatic task generation.
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Stock Adjustment / Transfer Orders
# ─────────────────────────────────────────────────────────────────────────────

try:
    from apps.inventory.models import StockAdjustmentOrder, StockTransferOrder
except ImportError:
    StockAdjustmentOrder = None
    StockTransferOrder = None


if StockAdjustmentOrder:
    @receiver(post_save, sender=StockAdjustmentOrder)
    def handle_stock_adjustment_posted(sender, instance, **kwargs):
        """
        Fires when a StockAdjustmentOrder status changes to CONFIRMED.
        Triggers STOCK_ADJUSTMENT auto-task.
        """
        if getattr(instance, 'lifecycle_status', None) != 'CONFIRMED':
            return
        logger.info(f"[SIGNAL] StockAdjustmentOrder #{instance.id} confirmed — inventory adjusted")
        # ── Auto-Task: STOCK_ADJUSTMENT ──
        try:
            from apps.workspace.signals import trigger_inventory_event
            trigger_inventory_event(
                instance.organization, 'STOCK_ADJUSTMENT',
                reference=f'ADJ-{instance.id}',
                extra={'type': 'adjustment'},
            )
        except Exception:
            pass


if StockTransferOrder:
    @receiver(post_save, sender=StockTransferOrder)
    def handle_stock_transfer_posted(sender, instance, **kwargs):
        """
        Fires when a StockTransferOrder status changes to CONFIRMED.
        Triggers TRANSFER_CREATED auto-task.
        """
        if getattr(instance, 'lifecycle_status', None) != 'CONFIRMED':
            return
        logger.info(f"[SIGNAL] StockTransferOrder #{instance.id} confirmed — stock transferred")
        # ── Auto-Task: TRANSFER_CREATED ──
        try:
            from apps.workspace.signals import trigger_purchasing_event
            trigger_purchasing_event(
                instance.organization, 'TRANSFER_CREATED',
                reference=f'TRF-{instance.id}',
                extra={'type': 'transfer'},
            )
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# Product Creation & Price Change
# ─────────────────────────────────────────────────────────────────────────────

try:
    from apps.inventory.models import Product
except ImportError:
    Product = None


if Product:
    @receiver(post_save, sender=Product)
    def handle_product_saved(sender, instance, created, **kwargs):
        """
        Fires when a Product is created or updated.
        - On creation: fires PRODUCT_CREATED auto-task
        - On price change: fires PRICE_CHANGE auto-task
        """
        if not hasattr(instance, 'organization_id') or not instance.organization_id:
            return

        org = instance.organization

        # ── New Product ──
        if created:
            try:
                from apps.workspace.signals import trigger_inventory_event
                trigger_inventory_event(
                    org, 'PRODUCT_CREATED',
                    product_name=str(instance.name),
                    product_id=instance.id,
                    reference=instance.sku or instance.barcode or f'PROD-{instance.id}',
                )
            except Exception:
                pass
            return

        # ── Price Change Detection ──
        # Check if selling price changed by comparing with the update_fields hint
        update_fields = kwargs.get('update_fields')
        price_fields = {'selling_price_ht', 'selling_price_ttc', 'cost_price', 'cost_price_ht', 'cost_price_ttc'}

        # If update_fields is provided, check if any price field was updated
        price_changed = False
        if update_fields:
            price_changed = bool(price_fields & set(update_fields))
        else:
            # If no update_fields hint, check the _price_snapshot set by pre_save
            old_price = getattr(instance, '_old_selling_price_ttc', None)
            if old_price is not None and old_price != instance.selling_price_ttc:
                price_changed = True

        if price_changed:
            try:
                from apps.workspace.signals import trigger_inventory_event
                trigger_inventory_event(
                    org, 'PRICE_CHANGE',
                    product_name=str(instance.name),
                    product_id=instance.id,
                    reference=instance.sku or instance.barcode or f'PROD-{instance.id}',
                    extra={
                        'new_price': str(instance.selling_price_ttc),
                    },
                )
            except Exception:
                pass

    @receiver(pre_save, sender=Product)
    def snapshot_product_price(sender, instance, **kwargs):
        """Snapshot the old selling price before save for change detection."""
        if instance.pk:
            try:
                old = Product.objects.filter(pk=instance.pk).values_list('selling_price_ttc', flat=True).first()
                instance._old_selling_price_ttc = old
            except Exception:
                instance._old_selling_price_ttc = None
