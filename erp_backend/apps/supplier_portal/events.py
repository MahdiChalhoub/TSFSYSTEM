"""
Supplier Portal Module Event Handlers
======================================

Kernel OS v2.0 Integration - Simple event handling for supplier portal.
"""

import logging

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, tenant_id: int):
    """Main event handler for Supplier Portal module"""
    logger.info(f"[SupplierPortal] Received event: {event_name}")

    handlers = {
        'purchase_order.created': handle_po_created,
        'purchase_order.received': handle_po_received,
        'contact.created': handle_contact_created,
    }

    handler = handlers.get(event_name)
    if handler:
        try:
            return handler(payload, tenant_id)
        except Exception as e:
            logger.error(f"[SupplierPortal] Error: {e}")
            raise
    return {'success': True, 'skipped': True}


def handle_po_created(payload: dict, tenant_id: int):
    """Handle PO creation - notify supplier"""
    logger.info(f"[SupplierPortal] PO created")
    # TODO: Send PO to supplier via email/portal
    return {'success': True}


def handle_po_received(payload: dict, tenant_id: int):
    """Handle PO receipt - update supplier portal"""
    logger.info(f"[SupplierPortal] PO received")
    # TODO: Mark as received in supplier portal
    return {'success': True}


def handle_contact_created(payload: dict, tenant_id: int):
    """Handle supplier contact creation - send portal invite"""
    contact_type = payload.get('contact_type')
    if contact_type == 'SUPPLIER':
        logger.info(f"[SupplierPortal] Supplier contact created")
        # TODO: Send supplier portal invitation
    return {'success': True}
