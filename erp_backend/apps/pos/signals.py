"""
POS Module Signals
==================
Event-driven signal handlers for:
  - Sales lifecycle and supplier balance updates
  - Order → CRM analytics auto-compute (Gap 8)
  - PO → Inventory stock receipt (Gap 10)
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# ORDER LIFECYCLE
# =============================================================================

@receiver(post_save, sender='pos.Order')
def handle_order_status_change(sender, instance, **kwargs):
    """
    Fires when an Order is saved. Dispatches events via ConnectorEngine:
    - SALE + COMPLETED → order:completed
    - PURCHASE + COMPLETED → order:completed (handled differently by Finance)
    """
    if not instance.pk:
        return

    if instance.status == 'COMPLETED':
        from erp.connector_engine import ConnectorEngine
        connector = ConnectorEngine()
        
        payload = {
            'order_id': str(instance.id),
            'type': instance.type,
            'status': instance.status,
            'total_amount': float(instance.total_amount),
            'tax_amount': float(instance.tax_amount),
            'discount_amount': float(instance.discount_amount),
            'contact_id': str(instance.contact_id) if instance.contact_id else None,
            'site_id': str(instance.site_id) if instance.site_id else None,
            'payment_method': instance.payment_method,
            'reference': instance.ref_code or f"ORD-{instance.id}",
            'date': instance.created_at.isoformat() if instance.created_at else None,
            'lines': [
                {
                    'product_id': str(line.product_id),
                    'quantity': float(line.quantity),
                    'unit_price': float(line.unit_price),
                    'subtotal': float(line.subtotal),
                    'tax_rate': float(line.tax_rate),
                    'cost_price': float(line.product.cost_price) if line.product else 0.0
                } for line in instance.lines.all().select_related('product')
            ]
        }
        
        connector.dispatch_event(
            source_module='pos',
            event_name='order:completed',
            payload=payload,
            organization_id=str(instance.organization_id)
        )
        logger.info(f"[SIGNAL] Dispatched order:completed for {instance.type} #{instance.id}")


# =============================================================================
# RETURNS LIFECYCLE
# =============================================================================

@receiver(post_save, sender='pos.SalesReturn')
def handle_sales_return_status_change(sender, instance, **kwargs):
    if instance.status == 'APPROVED':
        logger.info(f"[SIGNAL] SalesReturn #{instance.id} approved")
    elif instance.status == 'COMPLETED':
        logger.info(f"[SIGNAL] SalesReturn #{instance.id} completed")


@receiver(post_save, sender='pos.PurchaseReturn')
def handle_purchase_return_status_change(sender, instance, **kwargs):
    if instance.status == 'COMPLETED':
        logger.info(f"[SIGNAL] PurchaseReturn #{instance.id} completed")


# =============================================================================
# PO → Inventory & Metrics
# =============================================================================

@receiver(post_save, sender='pos.PurchaseOrder')
def handle_po_status_change(sender, instance, **kwargs):
    """
    When a PO status changes, dispatch events for Inventory and CRM.
    - RECEIVED / PARTIALLY_RECEIVED → purchase_order:received
    - COMPLETED → purchase_order:completed
    """
    if not instance.pk:
        return

    from erp.connector_engine import ConnectorEngine
    connector = ConnectorEngine()

    if instance.status in ('RECEIVED', 'PARTIALLY_RECEIVED'):
        payload = {
            'po_id': str(instance.id),
            'po_number': instance.po_number,
            'status': instance.status,
            'supplier_id': str(instance.supplier_id) if hasattr(instance, 'supplier_id') else None,
            'site_id': str(instance.site_id) if hasattr(instance, 'site_id') else None,
            'warehouse_id': str(instance.warehouse_id) if hasattr(instance, 'warehouse_id') else None,
            'lines': [
                {
                    'line_id': str(line.id),
                    'product_id': str(line.product_id),
                    'qty_received': float(line.qty_received),
                    'unit_price': float(line.unit_price)
                } for line in instance.lines.all()
            ]
        }
        connector.dispatch_event('pos', 'purchase_order:received', payload, str(instance.organization_id))
        logger.info(f"[SIGNAL] Dispatched purchase_order:received for PO {instance.po_number}")

    if instance.status == 'COMPLETED':
        payload = {
            'po_id': str(instance.id),
            'po_number': instance.po_number,
            'supplier_id': str(instance.supplier_id) if hasattr(instance, 'supplier_id') else None,
            'total_amount': float(instance.total_amount),
            'order_date': instance.order_date.isoformat() if hasattr(instance, 'order_date') and instance.order_date else None
        }
        connector.dispatch_event('pos', 'purchase_order:completed', payload, str(instance.organization_id))
        logger.info(f"[SIGNAL] Dispatched purchase_order:completed for PO {instance.po_number}")
