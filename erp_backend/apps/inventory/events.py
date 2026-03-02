"""
Inventory Module Event Handlers
================================
Receives inter-module events routed by the ConnectorEngine.

The ConnectorEngine discovers this module via:
    importlib.import_module('apps.inventory.events')
"""

import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for the inventory module.
    """
    handlers = {
        'order:completed': _on_order_completed,
        'order:voided': _on_order_voided,
        'org:provisioned': _on_org_provisioned,
        'purchase_order:received': _on_purchase_order_received,
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
    """
    from .models import Inventory, InventoryMovement
    from erp.models import Organization
    
    order_id = payload.get('order_id')
    order_type = payload.get('type', 'SALE')
    lines = payload.get('lines', [])
    warehouse_id = payload.get('warehouse_id')
    
    # We only deduct stock if it's a SALE.
    # If it's a PURCHASE recorded in POS, we add stock.
    multiplier = -1 if order_type == 'SALE' else 1
    move_type = 'SALE' if order_type == 'SALE' else 'PURCHASE'

    if not lines:
        return {'success': True, 'skipped': True}
    
    try:
        org = Organization.objects.get(id=organization_id)
        adjusted = 0
        
        for line in lines:
            product_id = line.get('product_id')
            quantity = line.get('quantity', 0)
            
            if not product_id or quantity <= 0:
                continue
            
            # Find inventory record in the specified warehouse
            # If no warehouse_id, we might need a default one or fail
            if not warehouse_id:
                from .models import Warehouse
                default_wh = Warehouse.objects.filter(organization=org, location_type='WAREHOUSE').first()
                warehouse_id = default_wh.id if default_wh else None

            if not warehouse_id:
                logger.warning(f"Inventory: No warehouse found for org {organization_id}, skipping deduction")
                continue

            inv, created = Inventory.objects.get_or_create(
                organization=org,
                product_id=product_id,
                warehouse_id=warehouse_id,
                defaults={'quantity': 0}
            )
            
            # Atomic update
            inv.quantity += (Decimal(str(quantity)) * multiplier)
            inv.save(update_fields=['quantity'])
            
            InventoryMovement.objects.create(
                organization=org,
                product_id=product_id,
                warehouse_id=warehouse_id,
                type=move_type,
                quantity=(Decimal(str(quantity)) * multiplier),
                reference=f"ORDER-{order_id}"
            )
            adjusted += 1
        
        return {'success': True, 'adjusted_count': adjusted}
    except Exception as e:
        logger.error(f"Inventory: Failed to process order completion: {e}")
        return {'success': False, 'error': str(e)}


def _on_order_voided(payload: dict, organization_id: int) -> dict:
    """
    React to POS order void — reverse any stock movements made for the order.
    """
    from .models import Inventory, InventoryMovement
    from erp.models import Organization

    order_id = payload.get('order_id')
    order_type = payload.get('type', 'SALE')
    lines = payload.get('lines', [])
    warehouse_id = payload.get('warehouse_id')

    if not lines:
        return {'success': True, 'skipped': True}

    # Reverse the multiplier: void a SALE means adding stock back
    multiplier = 1 if order_type == 'SALE' else -1
    move_type = 'VOID_REVERSAL'

    try:
        org = Organization.objects.get(id=organization_id)
        reversed_count = 0

        for line in lines:
            product_id = line.get('product_id')
            quantity = line.get('quantity', 0)

            if not product_id or quantity <= 0:
                continue

            if not warehouse_id:
                from .models import Warehouse
                default_wh = Warehouse.objects.filter(organization=org, location_type='WAREHOUSE').first()
                wh_id = default_wh.id if default_wh else None
            else:
                wh_id = warehouse_id

            if not wh_id:
                logger.warning(f"Inventory: No warehouse found for org {organization_id}, skipping void reversal")
                continue

            try:
                inv = Inventory.objects.get(organization=org, product_id=product_id, warehouse_id=wh_id)
                inv.quantity += (Decimal(str(quantity)) * multiplier)
                inv.save(update_fields=['quantity'])
            except Inventory.DoesNotExist:
                logger.warning(f"Inventory: No inventory record found for product {product_id} in warehouse {wh_id}")
                continue

            InventoryMovement.objects.create(
                organization=org,
                product_id=product_id,
                warehouse_id=wh_id,
                type=move_type,
                quantity=(Decimal(str(quantity)) * multiplier),
                reference=f"VOID-ORDER-{order_id}"
            )
            reversed_count += 1

        return {'success': True, 'reversed_count': reversed_count}
    except Exception as e:
        logger.error(f"Inventory: Failed to process order void: {e}")
        return {'success': False, 'error': str(e)}


def _on_purchase_order_received(payload: dict, organization_id: int) -> dict:
    """
    React to Purchase Order receipt — add stock.
    """
    from .models import Inventory, InventoryMovement, Warehouse
    from erp.models import Organization
    
    po_id = payload.get('po_id')
    po_number = payload.get('po_number')
    lines = payload.get('lines', [])
    warehouse_id = payload.get('warehouse_id')
    
    if not lines:
        return {'success': True, 'skipped': True}
    
    try:
        org = Organization.objects.get(id=organization_id)
        
        if not warehouse_id:
            default_wh = Warehouse.objects.filter(organization=org, location_type='WAREHOUSE').first()
            warehouse_id = default_wh.id if default_wh else None

        if not warehouse_id:
            logger.error(f"Inventory: No warehouse for PO receipt in org {organization_id}")
            return {'success': False, 'error': "No destination warehouse found"}

        received_count = 0
        for line in lines:
            product_id = line.get('product_id')
            qty = Decimal(str(line.get('qty_received', 0)))
            
            if qty <= 0: continue

            inv, created = Inventory.objects.get_or_create(
                organization=org,
                product_id=product_id,
                warehouse_id=warehouse_id,
                defaults={'quantity': 0}
            )
            
            inv.quantity += qty
            inv.save(update_fields=['quantity'])
            
            InventoryMovement.objects.create(
                organization=org,
                product_id=product_id,
                warehouse_id=warehouse_id,
                type='IN',
                quantity=qty,
                reference=f"PO-{po_number}-L{line.get('line_id')}",
                description=f"Received from PO {po_number}"
            )
            received_count += 1
            
        return {'success': True, 'received_count': received_count}
    except Exception as e:
        logger.error(f"Inventory: Failed to process PO receipt: {e}")
        return {'success': False, 'error': str(e)}


def _on_org_provisioned(payload: dict, organization_id: int) -> dict:
    """
    React to org provisioning — inventory module hook.
    Currently a no-op: warehouses are provisioned by the erp.services layer directly.
    """
    logger.info(f"Inventory: org:provisioned event received for org {organization_id} — no inventory-level action needed.")
    return {'success': True}
