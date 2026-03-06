"""
Inventory Module Event Handlers
================================

Handles events from other modules and emits inventory-related events.

Event Contracts Implemented:
- product.created (emits)
- inventory.low_stock (emits)
- inventory.adjustment (emits)
- order.completed (subscribes - updates inventory)
- invoice.paid (subscribes - may trigger stock reservation)
"""

import logging
from decimal import Decimal
from django.db import transaction
from kernel.events import emit_event, subscribe_to_event
from kernel.contracts.decorators import enforce_contract
from kernel.tenancy.context import get_current_tenant

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, tenant_id: int):
    """
    Main event handler for Inventory module

    Routes events to appropriate handlers based on event name.
    """
    logger.info(f"[Inventory] Received event: {event_name}")

    # Map event names to handler functions
    handlers = {
        'order.completed': handle_order_completed,
        'order.voided': handle_order_voided,
        'purchase_order.received': handle_purchase_order_received,
        'invoice.created': handle_invoice_created,
    }

    handler = handlers.get(event_name)

    if handler:
        try:
            handler(payload, tenant_id)
            logger.info(f"[Inventory] Successfully handled {event_name}")
        except Exception as e:
            logger.error(f"[Inventory] Error handling {event_name}: {e}")
            raise
    else:
        logger.warning(f"[Inventory] No handler for event: {event_name}")


@subscribe_to_event('order.completed')
@enforce_contract('order.completed')
def on_order_completed(event):
    """
    EventBus handler wrapper for order.completed
    Automatically registered and validated against contract.
    """
    handle_order_completed(event.payload, event.tenant_id)


@transaction.atomic
def handle_order_completed(payload: dict, tenant_id: int):
    """
    Handle order.completed event from POS module

    Decrements inventory when an order is completed.
    """
    from apps.inventory.models import Inventory, InventoryMovement

    order_id = payload.get('order_id')
    items = payload.get('items', [])

    logger.info(f"[Inventory] Processing order completion: {order_id}")

    for item in items:
        product_id = item.get('product_id')
        quantity = Decimal(str(item.get('quantity', 0)))
        warehouse_id = item.get('warehouse_id')  # May be in payload

        if not product_id or quantity <= 0:
            continue

        try:
            # Get inventory record
            inventory = Inventory.objects.get(
                product_id=product_id,
                warehouse_id=warehouse_id,
                tenant_id=tenant_id
            )

            # Check if sufficient stock
            if inventory.quantity < quantity:
                logger.warning(
                    f"[Inventory] Insufficient stock for product {product_id}: "
                    f"Available: {inventory.quantity}, Requested: {quantity}"
                )
                # Still process but emit warning event
                emit_event('inventory.insufficient_stock', {
                    'product_id': product_id,
                    'warehouse_id': warehouse_id,
                    'available_quantity': float(inventory.quantity),
                    'requested_quantity': float(quantity),
                    'tenant_id': tenant_id
                })

            # Decrement inventory
            old_quantity = inventory.quantity
            inventory.quantity -= quantity
            inventory.save()

            # Create movement record
            InventoryMovement.objects.create(
                inventory=inventory,
                movement_type='OUT',
                quantity=quantity,
                reference_type='ORDER',
                reference_id=order_id,
                notes=f'Sale from Order #{order_id}',
                tenant_id=tenant_id
            )

            # Check if stock is now low
            if inventory.quantity <= inventory.product.min_stock_level:
                emit_event('inventory.low_stock', {
                    'product_id': product_id,
                    'warehouse_id': warehouse_id,
                    'current_quantity': float(inventory.quantity),
                    'min_level': inventory.product.min_stock_level,
                    'tenant_id': tenant_id
                })

            logger.info(
                f"[Inventory] Updated stock for product {product_id}: "
                f"{old_quantity} → {inventory.quantity}"
            )

        except Inventory.DoesNotExist:
            logger.error(f"[Inventory] No inventory record for product {product_id}")
        except Exception as e:
            logger.error(f"[Inventory] Error processing item: {e}")
            raise


@subscribe_to_event('order.voided')
@enforce_contract('order.voided')
def on_order_voided(event):
    """EventBus handler wrapper for order.voided"""
    handle_order_voided(event.payload, event.tenant_id)


@transaction.atomic
def handle_order_voided(payload: dict, tenant_id: int):
    """
    Handle order.voided event

    Restores inventory when an order is voided.
    """
    from apps.inventory.models import Inventory, InventoryMovement

    order_id = payload.get('order_id')
    items = payload.get('items', [])

    logger.info(f"[Inventory] Processing order void: {order_id}")

    for item in items:
        product_id = item.get('product_id')
        quantity = Decimal(str(item.get('quantity', 0)))
        warehouse_id = item.get('warehouse_id')

        if not product_id or quantity <= 0:
            continue

        try:
            inventory = Inventory.objects.get(
                product_id=product_id,
                warehouse_id=warehouse_id,
                tenant_id=tenant_id
            )

            # Restore inventory
            inventory.quantity += quantity
            inventory.save()

            # Create movement record
            InventoryMovement.objects.create(
                inventory=inventory,
                movement_type='IN',
                quantity=quantity,
                reference_type='ORDER_VOID',
                reference_id=order_id,
                notes=f'Void of Order #{order_id}',
                tenant_id=tenant_id
            )

            logger.info(f"[Inventory] Restored stock for product {product_id}: +{quantity}")

        except Inventory.DoesNotExist:
            logger.error(f"[Inventory] No inventory record for product {product_id}")
        except Exception as e:
            logger.error(f"[Inventory] Error restoring item: {e}")
            raise


@subscribe_to_event('purchase_order.received')
@enforce_contract('purchase_order.received')
def on_purchase_order_received(event):
    """EventBus handler wrapper for purchase_order.received"""
    handle_purchase_order_received(event.payload, event.tenant_id)


@transaction.atomic
def handle_purchase_order_received(payload: dict, tenant_id: int):
    """
    Handle purchase_order.received event

    Increments inventory when goods are received.
    """
    from apps.inventory.models import Inventory, InventoryMovement

    po_id = payload.get('purchase_order_id')
    items = payload.get('items', [])
    warehouse_id = payload.get('warehouse_id')

    logger.info(f"[Inventory] Processing PO receipt: {po_id}")

    for item in items:
        product_id = item.get('product_id')
        quantity_received = Decimal(str(item.get('quantity_received', 0)))

        if not product_id or quantity_received <= 0:
            continue

        try:
            # Get or create inventory record
            inventory, created = Inventory.objects.get_or_create(
                product_id=product_id,
                warehouse_id=warehouse_id,
                tenant_id=tenant_id,
                defaults={'quantity': Decimal('0')}
            )

            # Increment inventory
            inventory.quantity += quantity_received
            inventory.save()

            # Create movement record
            InventoryMovement.objects.create(
                inventory=inventory,
                movement_type='IN',
                quantity=quantity_received,
                reference_type='PURCHASE_ORDER',
                reference_id=po_id,
                notes=f'Receipt from PO #{po_id}',
                tenant_id=tenant_id
            )

            logger.info(
                f"[Inventory] Received stock for product {product_id}: +{quantity_received}"
            )

        except Exception as e:
            logger.error(f"[Inventory] Error receiving item: {e}")
            raise


@subscribe_to_event('invoice.created')
@enforce_contract('invoice.created')
def on_invoice_created(event):
    """EventBus handler wrapper for invoice.created"""
    handle_invoice_created(event.payload, event.tenant_id)


def handle_invoice_created(payload: dict, tenant_id: int):
    """
    Handle invoice.created event

    May trigger stock reservation or allocation logic.
    For now, just logs - implement reservation logic as needed.
    """
    invoice_id = payload.get('invoice_id')
    logger.info(f"[Inventory] Invoice created: {invoice_id} - no action taken")
    # TODO: Implement stock reservation if needed


# Utility functions for inventory operations

def check_low_stock_and_emit(product_id: int, tenant_id: int):
    """
    Check if a product is low on stock and emit event if needed.

    Can be called from anywhere to check stock levels.
    """
    from apps.inventory.models import Inventory

    inventories = Inventory.objects.filter(
        product_id=product_id,
        tenant_id=tenant_id
    )

    for inventory in inventories:
        if inventory.quantity <= inventory.product.min_stock_level:
            emit_event('inventory.low_stock', {
                'product_id': product_id,
                'warehouse_id': inventory.warehouse_id,
                'current_quantity': float(inventory.quantity),
                'min_level': inventory.product.min_stock_level,
                'tenant_id': tenant_id
            })
