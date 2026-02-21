"""
Inventory Module Event Handlers
================================
Receives inter-module events routed by the ConnectorEngine.

The ConnectorEngine discovers this module via:
    importlib.import_module('apps.inventory.events')
"""

import logging

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for the inventory module.
    """
    handlers = {
        'order:completed': _on_order_completed,
        'order:voided': _on_order_voided,
        'org:provisioned': _on_org_provisioned,
    }
    
    handler = handlers.get(event_name)
    if handler:
        return handler(payload, organization_id)
    else:
        logger.debug(f"Inventory module: unhandled event '{event_name}'")
        return None


def _on_order_completed(payload: dict, organization_id: int) -> dict:
    """
    React to POS order completion — deduct stock for sold items.
    
    Payload expects:
        order_id: str
        lines: list of {product_id, quantity}
    """
    from .models import Inventory, InventoryMovement
    from erp.models import Organization
    
    order_id = payload.get('order_id')
    lines = payload.get('lines', [])
    site_id = payload.get('site_id')
    warehouse_id = payload.get('warehouse_id')
    
    if not lines:
        logger.debug(f"Inventory: order:completed with no lines, skipping")
        return {'success': True, 'skipped': True}
    
    try:
        org = Organization.objects.get(id=organization_id)
        adjusted = 0
        
        for line in lines:
            product_id = line.get('product_id')
            quantity = line.get('quantity', 0)
            
            if not product_id or quantity <= 0:
                continue
            
            inv = Inventory.objects.filter(
                organization=org,
                product_id=product_id,
                warehouse_id=warehouse_id
            ).first()
            
            if inv:
                inv.quantity -= quantity
                inv.save(update_fields=['quantity'])
                
                InventoryMovement.objects.create(
                    organization=org,
                    product_id=product_id,
                    warehouse_id=warehouse_id,
                    type='SALE',
                    quantity=-quantity,
                    reference=f"ORDER-{order_id}"
                )
                adjusted += 1
        
        logger.info(f"📦 Inventory: Adjusted {adjusted} items for order {order_id}")
        return {'success': True, 'adjusted_count': adjusted}
        
    except Exception as e:
        logger.error(f"Inventory: Failed to process order:completed: {e}")
        return {'success': False, 'error': str(e)}


def _on_order_voided(payload: dict, organization_id: int) -> dict:
    """
    React to POS order void — restore stock for voided items.
    """
    logger.info(f"📦 Inventory: Order voided for org {organization_id}")
    # Future: Reverse stock deductions from _on_order_completed
    return {'success': True}


def _on_org_provisioned(payload: dict, organization_id: int) -> dict:
    """
    React to new org provisioning — set up default inventory categories.
    """
    logger.info(f"📦 Inventory: Org provisioned, default setup for org {organization_id}")
    # Future: Create default product categories, units of measure, etc.
    return {'success': True}
