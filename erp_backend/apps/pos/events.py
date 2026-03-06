"""
POS Module Event Handlers
==========================

Handles events from other modules and emits POS-related events.

Kernel OS v2.0 Integration - Event Contracts Implemented:
- order.completed (emits)
- order.voided (emits)
- payment.received (subscribes)
- inventory.low_stock (subscribes - alerts terminals)
- invoice.created (subscribes - associates with order)
"""

import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from kernel.events import emit_event, subscribe_to_event
from kernel.contracts.decorators import enforce_contract

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, tenant_id: int):
    """
    Main event handler for POS module (Kernel OS v2.0)

    Routes events to appropriate handlers based on event name.
    Compatible with both old (organization_id) and new (tenant_id) signatures.

    Args:
        event_name: The event identifier (e.g., 'order.completed')
        payload: Event data dictionary
        tenant_id: The tenant context (replaces organization_id)
    """
    logger.info(f"[POS] Received event: {event_name}")

    handlers = {
        # Kernel OS v2.0 events
        'payment.received': handle_payment_received,
        'inventory.low_stock': handle_low_stock_alert,
        'invoice.created': handle_invoice_created,
        'invoice.paid': handle_invoice_paid,

        # Legacy events (backward compatibility)
        'payment:received': _on_payment_received,
        'inventory:low_stock': _on_low_stock_alert,
    }

    handler = handlers.get(event_name)

    if handler:
        try:
            result = handler(payload, tenant_id)
            logger.info(f"[POS] Successfully handled {event_name}")
            return result
        except Exception as e:
            logger.error(f"[POS] Error handling {event_name}: {e}")
            raise
    else:
        logger.warning(f"[POS] No handler for event: {event_name}")
        return None


# ============================================================================
# KERNEL OS v2.0 EVENT HANDLERS
# ============================================================================

@subscribe_to_event('payment.received')
@enforce_contract('payment.received')
def on_payment_received(event):
    """EventBus handler wrapper for payment.received"""
    handle_payment_received(event.payload, event.tenant_id)


@transaction.atomic
def handle_payment_received(payload: dict, tenant_id: int):
    """
    Handle payment.received event (Kernel OS v2.0)

    Updates order payment status when payment is processed.
    """
    from apps.pos.models import Order

    order_id = payload.get('order_id')
    invoice_id = payload.get('invoice_id')
    amount = Decimal(str(payload.get('amount', 0)))
    payment_method = payload.get('payment_method', 'UNKNOWN')

    if not order_id:
        return {'success': True, 'skipped': True, 'reason': 'No order_id'}

    try:
        order = Order.objects.get(id=order_id, tenant_id=tenant_id)

        # Update payment status
        old_status = order.payment_status
        order.amount_paid += amount

        if order.amount_paid >= order.total_amount:
            order.payment_status = 'PAID'
            order.paid_at = timezone.now()
        elif order.amount_paid > 0:
            order.payment_status = 'PARTIAL'

        order.save(update_fields=['amount_paid', 'payment_status', 'paid_at', 'updated_at'])

        logger.info(
            f"[POS] Updated order {order_id} payment: "
            f"{old_status} → {order.payment_status}, paid: {amount}"
        )

        return {'success': True, 'old_status': old_status, 'new_status': order.payment_status}

    except Order.DoesNotExist:
        logger.warning(f"[POS] Order {order_id} not found for payment update")
        return {'success': False, 'error': 'Order not found'}
    except Exception as e:
        logger.error(f"[POS] Error updating order payment: {e}")
        raise


@subscribe_to_event('inventory.low_stock')
@enforce_contract('inventory.low_stock')
def on_low_stock_alert(event):
    """EventBus handler wrapper for inventory.low_stock"""
    handle_low_stock_alert(event.payload, event.tenant_id)


@transaction.atomic
def handle_low_stock_alert(payload: dict, tenant_id: int):
    """
    Handle inventory.low_stock event (Kernel OS v2.0)

    Notifies POS terminals about low stock to prevent overselling.
    """
    product_id = payload.get('product_id')
    warehouse_id = payload.get('warehouse_id')
    current_quantity = payload.get('current_quantity', 0)
    min_level = payload.get('min_level', 0)

    logger.info(
        f"[POS] Low stock alert: Product {product_id} @ Warehouse {warehouse_id} "
        f"({current_quantity} remaining, min: {min_level})"
    )

    # TODO: Push notification to POS terminals
    # Could use WebSocket, Redis Pub/Sub, or database polling

    # For now, just log and mark for terminal notification
    # In production, this would:
    # 1. Update cache with low stock flag
    # 2. Broadcast to connected POS terminals
    # 3. Update terminal UI to show warning

    return {
        'success': True,
        'notification_sent': False,  # Not implemented yet
        'product_id': product_id,
        'action_required': 'notify_terminals'
    }


@subscribe_to_event('invoice.created')
@enforce_contract('invoice.created')
def on_invoice_created(event):
    """EventBus handler wrapper for invoice.created"""
    handle_invoice_created(event.payload, event.tenant_id)


def handle_invoice_created(payload: dict, tenant_id: int):
    """
    Handle invoice.created event (Kernel OS v2.0)

    Associates invoice with order if order reference exists.
    """
    from apps.pos.models import Order

    invoice_id = payload.get('invoice_id')
    reference_type = payload.get('reference_type')
    reference_id = payload.get('reference_id')

    if reference_type != 'ORDER' or not reference_id:
        return {'success': True, 'skipped': True}

    try:
        order = Order.objects.get(id=reference_id, tenant_id=tenant_id)

        # Store invoice reference if field exists
        if hasattr(order, 'invoice_id'):
            order.invoice_id = invoice_id
            order.save(update_fields=['invoice_id', 'updated_at'])

            logger.info(f"[POS] Associated invoice {invoice_id} with order {reference_id}")

        return {'success': True}

    except Order.DoesNotExist:
        logger.warning(f"[POS] Order {reference_id} not found for invoice association")
        return {'success': False, 'error': 'Order not found'}
    except Exception as e:
        logger.error(f"[POS] Error associating invoice: {e}")
        raise


@subscribe_to_event('invoice.paid')
@enforce_contract('invoice.paid')
def on_invoice_paid(event):
    """EventBus handler wrapper for invoice.paid"""
    handle_invoice_paid(event.payload, event.tenant_id)


def handle_invoice_paid(payload: dict, tenant_id: int):
    """
    Handle invoice.paid event (Kernel OS v2.0)

    Marks order as fully paid when associated invoice is paid.
    """
    from apps.pos.models import Order

    invoice_id = payload.get('invoice_id')

    try:
        # Find order by invoice reference
        order = Order.objects.filter(
            invoice_id=invoice_id,
            tenant_id=tenant_id
        ).first()

        if not order:
            return {'success': True, 'skipped': True, 'reason': 'No order found for invoice'}

        # Mark order as paid
        order.payment_status = 'PAID'
        order.paid_at = timezone.now()
        order.save(update_fields=['payment_status', 'paid_at', 'updated_at'])

        logger.info(f"[POS] Marked order {order.id} as PAID from invoice {invoice_id}")

        return {'success': True, 'order_id': order.id}

    except Exception as e:
        logger.error(f"[POS] Error marking order as paid: {e}")
        raise


# ============================================================================
# EVENT EMISSION UTILITIES
# ============================================================================

def emit_order_completed(order):
    """
    Emit order.completed event

    Call this when an order is successfully completed.

    Args:
        order: Order instance
    """
    from apps.pos.models import OrderLine

    # Get order lines
    lines = OrderLine.objects.filter(order=order).select_related('product')

    items = []
    for line in lines:
        items.append({
            'product_id': line.product_id,
            'quantity': float(line.quantity),
            'unit_price': float(line.price),
            'total': float(line.total),
            'warehouse_id': getattr(line, 'warehouse_id', None),
        })

    # Emit event
    emit_event('order.completed', {
        'order_id': order.id,
        'customer_id': order.customer_id if hasattr(order, 'customer_id') else None,
        'total_amount': float(order.total_amount),
        'currency': getattr(order, 'currency', 'USD'),
        'payment_method': getattr(order, 'payment_method', 'CASH'),
        'items': items,
        'tenant_id': order.tenant_id
    })

    logger.info(f"[POS] Emitted order.completed for order {order.id}")


def emit_order_voided(order):
    """
    Emit order.voided event

    Call this when an order is voided/cancelled.

    Args:
        order: Order instance
    """
    from apps.pos.models import OrderLine

    # Get order lines
    lines = OrderLine.objects.filter(order=order).select_related('product')

    items = []
    for line in lines:
        items.append({
            'product_id': line.product_id,
            'quantity': float(line.quantity),
            'warehouse_id': getattr(line, 'warehouse_id', None),
        })

    # Emit event
    emit_event('order.voided', {
        'order_id': order.id,
        'void_reason': getattr(order, 'void_reason', 'User requested'),
        'items': items,
        'tenant_id': order.tenant_id
    })

    logger.info(f"[POS] Emitted order.voided for order {order.id}")


# ============================================================================
# LEGACY EVENT HANDLERS (Backward Compatibility)
# ============================================================================

def _on_payment_received(payload: dict, organization_id: int) -> dict:
    """
    Legacy handler - redirects to new handler

    React to payment received — update order payment status.
    """
    return handle_payment_received(payload, organization_id)


def _on_low_stock_alert(payload: dict, organization_id: int) -> dict:
    """
    Legacy handler - redirects to new handler

    React to inventory low stock alert — notify POS terminals.
    """
    return handle_low_stock_alert(payload, organization_id)
