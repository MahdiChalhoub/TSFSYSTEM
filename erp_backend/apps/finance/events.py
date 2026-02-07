"""
Finance Module Event Handlers
==============================
Receives inter-module events routed by the ConnectorEngine.

The ConnectorEngine discovers this module via:
    importlib.import_module('apps.finance.events')
    
And calls handle_event() for each subscribed event.

To subscribe to events, register them in your ModuleContract's
`needs.events_from` JSON field.
"""

import logging

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for the finance module.
    
    Called by ConnectorEngine._deliver_event when an event is
    routed to this module.
    
    Args:
        event_name: The event identifier (e.g., 'order:completed')
        payload: Event data dictionary
        organization_id: The tenant context
    """
    handlers = {
        'order:completed': _on_order_completed,
        'inventory:adjusted': _on_inventory_adjusted,
        'subscription:renewed': _on_subscription_renewed,
    }
    
    handler = handlers.get(event_name)
    if handler:
        handler(payload, organization_id)
    else:
        logger.debug(f"Finance module: unhandled event '{event_name}'")


def _on_order_completed(payload: dict, organization_id: int):
    """React to POS order completion — create journal entries."""
    logger.info(f"💰 Finance: Processing order completion for org {organization_id}")
    # Future: Auto-create journal entries from completed orders
    # order_id = payload.get('order_id')
    # JournalEntryService.create_from_order(order_id, organization_id)


def _on_inventory_adjusted(payload: dict, organization_id: int):
    """React to inventory adjustments — update asset valuations."""
    logger.info(f"📦 Finance: Inventory adjustment received for org {organization_id}")
    # Future: Update inventory asset account values


def _on_subscription_renewed(payload: dict, organization_id: int):
    """React to subscription renewals — record revenue."""
    logger.info(f"🔄 Finance: Subscription renewal for org {organization_id}")
    # Future: Create revenue recognition journal entries
