"""
POS Module Signals
==================
Event-driven signal handlers for:
  - Sales lifecycle and supplier balance updates
  - Order → CRM analytics auto-compute
  - PO → Inventory stock receipt (Gap 10)
  - Gap 8: SalesAuditLog field-diff capture via pre/post_save
"""
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# GAP 8 — SALES AUDIT: Field-level diff capture on Order save
# =============================================================================

_TRACKED_STATUS_FIELDS = [
    'order_status', 'delivery_status', 'payment_status', 'invoice_status',
]
_TRACKED_EXTRA_FIELDS  = [
    'total_amount', 'payment_method', 'is_locked', 'is_verified',
    'invoice_number', 'scope',
]
_STATUS_ACTION_MAP = {
    ('order_status',    'CONFIRMED'):   'ORDER_CONFIRMED',
    ('order_status',    'PROCESSING'):  'ORDER_PROCESSING',
    ('order_status',    'CLOSED'):      'ORDER_CLOSED',
    ('order_status',    'CANCELLED'):   'ORDER_CANCELLED',
    ('delivery_status', 'PARTIAL'):     'DELIVERY_PARTIAL',
    ('delivery_status', 'DELIVERED'):   'DELIVERY_DELIVERED',
    ('delivery_status', 'RETURNED'):    'DELIVERY_RETURNED',
    ('delivery_status', 'NA'):          'DELIVERY_NA',
    ('payment_status',  'PARTIAL'):     'PAYMENT_PARTIAL',
    ('payment_status',  'PAID'):        'PAYMENT_PAID',
    ('payment_status',  'WRITTEN_OFF'): 'PAYMENT_WRITTEN_OFF',
    ('payment_status',  'OVERPAID'):    'PAYMENT_OVERPAID',
    ('invoice_status',  'GENERATED'):   'INVOICE_GENERATED',
    ('invoice_status',  'SENT'):        'INVOICE_SENT',
    ('invoice_status',  'DISPUTED'):    'INVOICE_DISPUTED',
}


@receiver(pre_save, sender='pos.Order')
def _capture_order_snapshot(sender, instance, **kwargs):
    """Before save: store current DB values for diff in post_save."""
    if not instance.pk:
        instance._audit_snapshot = {}
        return
    try:
        db_state = sender.original_objects.filter(pk=instance.pk).values(
            *_TRACKED_STATUS_FIELDS, *_TRACKED_EXTRA_FIELDS
        ).first() or {}
        instance._audit_snapshot = db_state
    except Exception:
        instance._audit_snapshot = {}


@receiver(post_save, sender='pos.Order')
def _log_order_field_changes(sender, instance, created, **kwargs):
    """After save: diff snapshot vs new state → write SalesAuditLog row."""
    try:
        from apps.pos.models.audit_models import SalesAuditLog

        snapshot = getattr(instance, '_audit_snapshot', {})
        if not snapshot and not created:
            return

        diff = {}
        action_type  = 'FIELD_CHANGE'
        summary_parts = []

        for field in _TRACKED_STATUS_FIELDS + _TRACKED_EXTRA_FIELDS:
            old_val = snapshot.get(field)
            new_val = getattr(instance, field, None)
            if old_val != new_val:
                diff[field] = {
                    'before': str(old_val) if old_val is not None else None,
                    'after':  str(new_val) if new_val is not None else None,
                }

        for field in _TRACKED_STATUS_FIELDS:
            if field in diff:
                new_val = diff[field]['after']
                mapped  = _STATUS_ACTION_MAP.get((field, new_val))
                if mapped:
                    action_type = mapped
                    summary_parts.append(
                        f"{field.replace('_', ' ').title()}: "
                        f"{diff[field]['before']} → {diff[field]['after']}"
                    )
                    break

        if not diff:
            if created:
                summary_parts = ['Order created']
            else:
                return

        if not summary_parts:
            summary_parts = [f"Fields changed: {', '.join(diff.keys())}"]

        SalesAuditLog.log(
            order=instance,
            action_type=action_type,
            summary=' | '.join(summary_parts),
            actor=None,  # system-level; actor written separately by workflow _log()
            diff=diff,
        )
    except Exception:
        pass  # never block order saves



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
