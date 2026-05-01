"""
Inventory Connector Service
=============================
Declares all capabilities that the Inventory module exposes.

Other modules use:
    connector.require('inventory.products.get_detail', org_id=X, product_id=Y)
    connector.execute('inventory.stock.reserve', org_id=X, product_id=Y, qty=5)
"""

import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by CapabilityRegistry during auto-discovery."""

    # ─── PRODUCTS ────────────────────────────────────────────────────

    @_cap(registry, 'inventory.products.get_detail',
          description='Get product by ID', cacheable=True, cache_ttl=120)
    def get_product_detail(org_id, product_id=None, **kw):
        from apps.inventory.models import Product
        if not product_id:
            return None
        try:
            p = Product.objects.get(id=product_id, organization_id=org_id)
            return {
                'id': p.id, 'name': p.name, 'sku': getattr(p, 'sku', ''),
                'barcode': getattr(p, 'barcode', ''),
                'purchase_price': float(getattr(p, 'purchase_price', 0) or 0),
                'selling_price': float(getattr(p, 'selling_price', 0) or 0),
                'tva_rate': float(getattr(p, 'tva_rate', 0) or 0),
                'current_stock': float(getattr(p, 'current_stock', 0) or 0),
                'is_active': getattr(p, 'is_active', True),
            }
        except Exception:
            return None

    @_cap(registry, 'inventory.products.list',
          description='List products for an organization',
          cacheable=True, cache_ttl=60)
    def list_products(org_id, search=None, category_id=None, limit=100, **kw):
        from apps.inventory.models import Product
        from django.db.models import Q
        qs = Product.objects.filter(organization_id=org_id, is_active=True)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search))
        if category_id:
            qs = qs.filter(category_id=category_id)
        return list(qs.values(
            'id', 'name', 'sku', 'barcode', 'purchase_price',
            'selling_price', 'current_stock'
        )[:limit])

    @_cap(registry, 'inventory.products.get_model',
          description='Get the Product model class',
          cacheable=False, critical=False)
    def get_product_model(org_id=0, **kw):
        from apps.inventory.models import Product
        return Product

    # ─── WAREHOUSES ──────────────────────────────────────────────────

    @_cap(registry, 'inventory.warehouses.list',
          description='List warehouses/sites',
          cacheable=True, cache_ttl=300)
    def list_warehouses(org_id, site_only=False, **kw):
        from apps.inventory.models import Warehouse
        qs = Warehouse.objects.filter(organization_id=org_id)
        if site_only:
            qs = qs.filter(parent__isnull=True)
        return list(qs.values('id', 'name', 'code', 'parent_id', 'is_active'))

    @_cap(registry, 'inventory.warehouses.get_model',
          description='Get Warehouse model class',
          cacheable=False, critical=False)
    def get_warehouse_model(org_id=0, **kw):
        from apps.inventory.models import Warehouse
        return Warehouse

    # ─── STOCK ───────────────────────────────────────────────────────

    @_cap(registry, 'inventory.stock.get_level',
          description='Get current stock level for a product at a warehouse',
          cacheable=True, cache_ttl=30)
    def get_stock_level(org_id, product_id=None, warehouse_id=None, **kw):
        from apps.inventory.models import Product
        try:
            p = Product.objects.get(id=product_id, organization_id=org_id)
            return {
                'product_id': p.id,
                'current_stock': float(getattr(p, 'current_stock', 0) or 0),
                'min_stock_level': float(getattr(p, 'min_stock_level', 0) or 0),
            }
        except Exception:
            return None

    @_cap(registry, 'inventory.stock.reserve',
          description='Reserve stock for an order',
          fallback_type='WRITE', critical=True, cacheable=False)
    def reserve_stock(org_id, product_id=None, warehouse_id=None, quantity=0, reference='', **kw):
        try:
            from apps.inventory.services.reservation_service import StockReservationService
            return StockReservationService.reserve(
                organization_id=org_id,
                product_id=product_id,
                warehouse_id=warehouse_id,
                quantity=quantity,
                reference=reference,
            )
        except ImportError:
            logger.warning("StockReservationService not available")
            return None

    @_cap(registry, 'inventory.stock.receive',
          description='Receive stock into warehouse',
          fallback_type='WRITE', critical=True, cacheable=False)
    def receive_stock(org_id, product_id=None, warehouse_id=None,
                      quantity=0, cost_price_ht=0, reference='', scope='OFFICIAL', **kw):
        try:
            from apps.inventory.services.stock_service import StockService
            return StockService.receive_stock(
                organization_id=org_id,
                product_id=product_id,
                warehouse_id=warehouse_id,
                quantity=quantity,
                cost_price_ht=cost_price_ht,
                reference=reference,
                scope=scope,
            )
        except ImportError:
            logger.warning("StockService not available for receive")
            return None

    # ─── DELIVERY ZONES ──────────────────────────────────────────────

    @_cap(registry, 'inventory.delivery_zones.get_model',
          description='Get DeliveryZone model class',
          cacheable=False, critical=False)
    def get_delivery_zone_model(org_id=0, **kw):
        from apps.inventory.models import DeliveryZone
        return DeliveryZone

    # ─── PRODUCT STOCK / LEDGER ──────────────────────────────────────

    @_cap(registry, 'inventory.product_stock.get_model',
          description='Get ProductStock model class',
          cacheable=False, critical=False)
    def get_product_stock_model(org_id=0, **kw):
        from apps.inventory.models import ProductStock
        return ProductStock

    @_cap(registry, 'inventory.stock_ledger.get_model',
          description='Get StockLedger model class',
          cacheable=False, critical=False)
    def get_stock_ledger_model(org_id=0, **kw):
        from apps.inventory.models import StockLedger
        return StockLedger

    # ─── SERVICES ────────────────────────────────────────────────────

    @_cap(registry, 'inventory.services.get_reservation_service',
          description='Get StockReservationService class',
          cacheable=False, critical=False)
    def get_reservation_service(org_id=0, **kw):
        from apps.inventory.services.reservation_service import StockReservationService
        return StockReservationService

    @_cap(registry, 'inventory.services.get_reservation_error',
          description='Get StockReservationError class',
          cacheable=False, critical=False)
    def get_reservation_error(org_id=0, **kw):
        from apps.inventory.services.reservation_service import StockReservationError
        return StockReservationError

    @_cap(registry, 'inventory.services.get_inventory_service',
          description='Get InventoryService class',
          cacheable=False, critical=False)
    def get_inventory_service(org_id=0, **kw):
        from apps.inventory.services import InventoryService
        return InventoryService

    # ─── CATEGORY MODEL ──────────────────────────────────────────────

    @_cap(registry, 'inventory.categories.get_model',
          description='Get Category model class',
          cacheable=False, critical=False)
    def get_category_model(org_id=0, **kw):
        from apps.inventory.models import Category
        return Category

    @_cap(registry, 'inventory.inventory.get_model',
          description='Get Inventory model class',
          cacheable=False, critical=False)
    def get_inventory_model(org_id=0, **kw):
        from apps.inventory.models import Inventory
        return Inventory

    # ─── STOCK SERVICE ───────────────────────────────────────────────

    @_cap(registry, 'inventory.services.get_stock_service',
          description='Get StockService class',
          cacheable=False, critical=False)
    def get_stock_service(org_id=0, **kw):
        from apps.inventory.services.stock_service import StockService
        return StockService

    # ─── GOODS RECEIPT MODELS ────────────────────────────────────────

    @_cap(registry, 'inventory.goods_receipt.get_model',
          description='Get GoodsReceipt model class',
          cacheable=False, critical=False)
    def get_goods_receipt_model(org_id=0, **kw):
        from apps.inventory.models.goods_receipt_models import GoodsReceipt
        return GoodsReceipt

    @_cap(registry, 'inventory.goods_receipt.get_line_model',
          description='Get GoodsReceiptLine model class',
          cacheable=False, critical=False)
    def get_goods_receipt_line_model(org_id=0, **kw):
        from apps.inventory.models.goods_receipt_models import GoodsReceiptLine
        return GoodsReceiptLine

    # ─── ADVANCED MODELS ─────────────────────────────────────────────

    @_cap(registry, 'inventory.advanced.get_procurement_request_model',
          description='Get ProcurementRequest model class',
          cacheable=False, critical=False)
    def get_procurement_request_model(org_id=0, **kw):
        from apps.inventory.models.advanced_models import ProcurementRequest
        return ProcurementRequest

    @_cap(registry, 'inventory.movements.get_model',
          description='Get InventoryMovement model class',
          cacheable=False, critical=False)
    def get_inventory_movement_model(org_id=0, **kw):
        from apps.inventory.models import InventoryMovement
        return InventoryMovement

    @_cap(registry, 'inventory.advanced.get_product_batch_model',
          description='Get ProductBatch model class',
          cacheable=False, critical=False)
    def get_product_batch_model(org_id=0, **kw):
        from apps.inventory.models.advanced_models import ProductBatch
        return ProductBatch

    # ─── PROCUREMENT STATUS ──────────────────────────────────────────

    @_cap(registry, 'inventory.services.get_procurement_status',
          description='Get batch procurement status for product IDs',
          cacheable=False, critical=False)
    def get_procurement_status(org_id=0, organization=None, product_ids=None, **kw):
        from apps.inventory.services.procurement_status_service import get_procurement_status_batch
        if organization is None:
            from erp.models import Organization
            organization = Organization.objects.get(id=org_id)
        return get_procurement_status_batch(organization, product_ids or [])

    @_cap(registry, 'inventory.services.get_product_completeness_service',
          description='Get ProductCompletenessService class',
          cacheable=False, critical=False)
    def get_product_completeness_service(org_id=0, **kw):
        from apps.inventory.services.product_completeness import ProductCompletenessService
        return ProductCompletenessService


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator

