"""
eCommerce Multi-Warehouse Router
==================================
Selects the optimal warehouse for fulfilling a ClientOrder line,
respecting the org's inventory_check_mode and delivery zones.

Resolution priority:
  1. Warehouse linked to the contact's delivery zone (if configured)
  2. Any warehouse with sufficient stock (STRICT mode only)
  3. Primary warehouse (first by creation — fallback for ALLOW_OVERSALE / DISABLED)

Usage:
    from apps.client_portal.warehouse_router import WarehouseRouter

    warehouse = WarehouseRouter.select_warehouse(
        organization=order.organization,
        product=line.product,
        quantity=line.quantity,
        contact=order.contact,
        check_mode='STRICT',
    )
"""
import logging
from decimal import Decimal
from erp.connector_registry import connector

logger = logging.getLogger('client_portal.warehouse_router')


class WarehouseRouter:

    @staticmethod
    def select_warehouse(
        organization,
        product,
        quantity: Decimal,
        contact=None,
        check_mode: str = 'STRICT',
    ):
        """
        Returns the best Warehouse for this line item.

        Args:
            organization: erp.Organization
            product:      inventory.Product
            quantity:     Required quantity (Decimal)
            contact:      crm.Contact or None
            check_mode:   'STRICT' | 'ALLOW_OVERSALE' | 'DISABLED'

        Returns:
            inventory.Warehouse instance, or raises ValueError if none available.
        """
        Warehouse = connector.require('inventory.warehouses.get_model', org_id=0, source='client_portal')
        if not Warehouse:
            return None

        all_warehouses = Warehouse.objects.filter(
            organization=organization,
        ).order_by('id')   # consistent ordering; id=lowest = primary

        if not all_warehouses.exists():
            raise ValueError("No warehouses configured for this organization.")

        primary = all_warehouses.first()

        # ── 1. Zone-preferred warehouse ──────────────────────────────────────
        zone_warehouse = WarehouseRouter._get_zone_warehouse(
            organization, contact, all_warehouses
        )

        if check_mode == 'DISABLED':
            # No stock checking — use zone warehouse if configured, else primary
            return zone_warehouse or primary

        # ── 2. Try zone warehouse first if it has stock ───────────────────────
        if zone_warehouse:
            stock = WarehouseRouter._available_stock(product, zone_warehouse)
            if stock >= quantity or check_mode == 'ALLOW_OVERSALE':
                logger.debug(
                    f"[WarehouseRouter] Zone warehouse '{zone_warehouse.name}' "
                    f"selected for order (stock={stock}, needed={quantity})"
                )
                return zone_warehouse

        # ── 3. Walk all warehouses in order, pick first with enough stock ─────
        for warehouse in all_warehouses:
            if warehouse == zone_warehouse:
                continue  # already tried
            stock = WarehouseRouter._available_stock(product, warehouse)
            if stock >= quantity:
                logger.debug(
                    f"[WarehouseRouter] Warehouse '{warehouse.name}' "
                    f"selected (stock={stock}, needed={quantity})"
                )
                return warehouse

        # ── 4. Fallback: primary warehouse (ALLOW_OVERSALE allows negative) ───
        if check_mode == 'ALLOW_OVERSALE':
            logger.info(
                f"[WarehouseRouter] No warehouse has sufficient stock for "
                f"product #{product.id}. Using primary (ALLOW_OVERSALE)."
            )
            return zone_warehouse or primary

        # STRICT: no warehouse can fulfill — raise to let caller surface the error
        raise ValueError(
            f"Insufficient stock for '{product.name}' (needed {quantity}). "
            f"No warehouse can fulfill this order."
        )

    @staticmethod
    def _get_zone_warehouse(organization, contact, all_warehouses):
        """
        Returns the warehouse assigned to the contact's delivery zone, if any.
        Falls back to None if not configured or contact is None.
        """
        if not contact:
            return None
        try:
            DeliveryZone = connector.require('inventory.delivery_zones.get_model', org_id=0, source='client_portal')
            # DeliveryZone may have a `warehouse` FK (check if field exists)
            zone = DeliveryZone.objects.filter(
                organization=organization,
                contacts=contact,
            ).select_related('warehouse').first()
            if zone and hasattr(zone, 'warehouse') and zone.warehouse:
                # Confirm this warehouse belongs to the same org
                if zone.warehouse in all_warehouses:
                    return zone.warehouse
        except Exception:
            pass
        return None

    @staticmethod
    def _available_stock(product, warehouse) -> Decimal:
        """
        Returns current available stock for product in warehouse.
        Uses StockLedger if available, falls back to ProductStock.
        """
        try:
            ProductStock = connector.require('inventory.product_stock.get_model', org_id=0, source='client_portal')
            stock_record = ProductStock.objects.filter(
                product=product,
                warehouse=warehouse,
            ).first()
            if stock_record:
                return Decimal(str(stock_record.quantity_on_hand or 0))
        except Exception:
            pass

        try:
            # Fallback: use StockLedger net balance
            StockLedger = connector.require('inventory.stock_ledger.get_model', org_id=0, source='client_portal')
            from django.db.models import Sum
            net = StockLedger.objects.filter(
                product=product,
                warehouse=warehouse,
            ).aggregate(net=Sum('quantity'))['net']
            return Decimal(str(net or 0))
        except Exception:
            pass

        return Decimal('0')
