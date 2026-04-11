"""
POS Connector Service
=======================
Declares all capabilities that the POS module exposes.
"""

import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by CapabilityRegistry during auto-discovery."""

    # ─── PURCHASE ORDERS ─────────────────────────────────────────────

    @_cap(registry, 'pos.purchase_orders.get_detail',
          description='Get purchase order by ID',
          cacheable=True, cache_ttl=60)
    def get_po_detail(org_id, po_id=None, **kw):
        from apps.pos.models import PurchaseOrder
        if not po_id:
            return None
        try:
            po = PurchaseOrder.objects.get(id=po_id, organization_id=org_id)
            return {
                'id': po.id,
                'po_number': po.po_number,
                'status': po.status,
                'supplier_id': po.supplier_id,
                'supplier_name': po.supplier_name,
                'total_amount': float(po.total_amount or 0),
                'currency': po.currency,
                'order_date': po.order_date.isoformat() if po.order_date else None,
                'expected_date': po.expected_date.isoformat() if po.expected_date else None,
            }
        except Exception:
            return None

    @_cap(registry, 'pos.purchase_orders.list',
          description='List purchase orders',
          cacheable=True, cache_ttl=30)
    def list_purchase_orders(org_id, status=None, supplier_id=None, limit=50, **kw):
        from apps.pos.models import PurchaseOrder
        qs = PurchaseOrder.objects.filter(organization_id=org_id)
        if status:
            qs = qs.filter(status=status)
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return list(qs.values(
            'id', 'po_number', 'status', 'supplier_name',
            'total_amount', 'currency', 'created_at'
        ).order_by('-created_at')[:limit])

    @_cap(registry, 'pos.purchase_orders.get_model',
          description='Get PurchaseOrder model class',
          cacheable=False, critical=False)
    def get_po_model(org_id=0, **kw):
        from apps.pos.models import PurchaseOrder
        return PurchaseOrder

    @_cap(registry, 'pos.purchase_order_lines.get_model',
          description='Get PurchaseOrderLine model class',
          cacheable=False, critical=False)
    def get_po_line_model(org_id=0, **kw):
        from apps.pos.models import PurchaseOrderLine
        return PurchaseOrderLine

    @_cap(registry, 'pos.purchase_orders.get_serializer',
          description='Get PurchaseOrder serializer class',
          cacheable=False, critical=False)
    def get_po_serializer(org_id=0, **kw):
        from apps.pos.purchase_order_serializers import PurchaseOrderSerializer
        return PurchaseOrderSerializer

    # ─── ORDERS ──────────────────────────────────────────────────────

    @_cap(registry, 'pos.orders.get_detail',
          description='Get order by ID',
          cacheable=True, cache_ttl=60)
    def get_order_detail(org_id, order_id=None, **kw):
        from apps.pos.models import Order
        if not order_id:
            return None
        try:
            o = Order.objects.get(id=order_id, organization_id=org_id)
            return {
                'id': o.id,
                'order_number': getattr(o, 'order_number', ''),
                'status': o.status,
                'total_amount': float(o.total_amount or 0),
                'payment_method': getattr(o, 'payment_method', ''),
            }
        except Exception:
            return None

    @_cap(registry, 'pos.orders.get_model',
          description='Get Order model class',
          cacheable=False, critical=False)
    def get_order_model(org_id=0, **kw):
        from apps.pos.models import Order
        return Order

    @_cap(registry, 'pos.purchase_order_lines.get_model',
          description='Get PurchaseOrderLine model class',
          cacheable=False, critical=False)
    def get_po_line_model(org_id=0, **kw):
        from apps.pos.models import PurchaseOrderLine
        return PurchaseOrderLine

    # ─── DELIVERY ZONES ──────────────────────────────────────────────

    @_cap(registry, 'pos.delivery_zones.get_model',
          description='Get DeliveryZone model class',
          cacheable=False, critical=False)
    def get_delivery_zone_model(org_id=0, **kw):
        from apps.pos.models import DeliveryZone
        return DeliveryZone

    # ─── PROCUREMENT GOVERNANCE ──────────────────────────────────────

    @_cap(registry, 'pos.procurement.get_supplier_performance_model',
          description='Get SupplierPerformanceSnapshot model class',
          cacheable=False, critical=False)
    def get_supplier_performance_model(org_id=0, **kw):
        from apps.pos.models.procurement_governance_models import SupplierPerformanceSnapshot
        return SupplierPerformanceSnapshot

    @_cap(registry, 'pos.procurement.get_supplier_claim_model',
          description='Get SupplierClaim model class',
          cacheable=False, critical=False)
    def get_supplier_claim_model(org_id=0, **kw):
        from apps.pos.models.procurement_governance_models import SupplierClaim
        return SupplierClaim

    @_cap(registry, 'pos.services.get_returns_service',
          description='Get ReturnsService class',
          cacheable=False, critical=False)
    def get_returns_service(org_id=0, **kw):
        from apps.pos.services.returns_service import ReturnsService
        return ReturnsService

    # ─── ORDER LINE MODELS ───────────────────────────────────────────

    @_cap(registry, 'pos.order_lines.get_model',
          description='Get OrderLine model class',
          cacheable=False, critical=False)
    def get_order_line_model(org_id=0, **kw):
        from apps.pos.models import OrderLine
        return OrderLine

    @_cap(registry, 'pos.order_lines.get_tax_entry_model',
          description='Get OrderLineTaxEntry model class',
          cacheable=False, critical=False)
    def get_order_line_tax_entry_model(org_id=0, **kw):
        from apps.pos.models import OrderLineTaxEntry
        return OrderLineTaxEntry


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
