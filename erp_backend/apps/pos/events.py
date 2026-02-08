"""
POS Module Event Handlers
==========================
Receives inter-module events routed by the ConnectorEngine.

The ConnectorEngine discovers this module via:
    importlib.import_module('apps.pos.events')
"""

import logging

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for the POS module.
    """
    handlers = {
        'payment:received': _on_payment_received,
        'inventory:low_stock': _on_low_stock_alert,
    }
    
    handler = handlers.get(event_name)
    if handler:
        return handler(payload, organization_id)
    else:
        logger.debug(f"POS module: unhandled event '{event_name}'")
        return None


def _on_payment_received(payload: dict, organization_id: int) -> dict:
    """
    React to payment received — update order payment status.
    """
    order_id = payload.get('order_id')
    amount = payload.get('amount')
    
    logger.info(f"💳 POS: Payment received for order {order_id}, amount={amount}")
    # Future: Mark order as paid, trigger receipt generation
    return {'success': True}


def _on_low_stock_alert(payload: dict, organization_id: int) -> dict:
    """
    React to inventory low stock alert — notify POS terminals.
    """
    product_id = payload.get('product_id')
    current_qty = payload.get('current_quantity')
    
    logger.info(f"⚠️ POS: Low stock alert for product {product_id} (qty={current_qty})")
    # Future: Push notification to POS terminals
    return {'success': True}
