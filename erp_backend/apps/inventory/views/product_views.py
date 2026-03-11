from apps.inventory.models import (
    Brand,
    Category,
    ComboComponent,
    Inventory,
    InventoryMovement,
    OperationalRequestLine,
    Parfum,
    Product,
    ProductGroup,
    Unit,
)
from apps.inventory.serializers import (
    ComboComponentSerializer,
    ProductCreateSerializer,
    ProductSerializer,
    StorefrontProductSerializer,
)
from .base import (
    AnonRateThrottle,
    Coalesce,
    Count,
    DecimalField,
    Organization,
    Q,
    Response,
    Sum,
    TenantModelViewSet,
    _get_org_or_400,
    action,
    permissions,
    status,
    timezone,
    timedelta,
    transaction,
)
from erp.mixins import UDLEViewSetMixin


from .product_bulk import ProductBulkMixin
from .product_analytics import ProductAnalyticsMixin
from .product_combo import ProductComboMixin
from .product_storefront import ProductStorefrontMixin
from erp.permissions import InventoryReadOnlyOrManage

class ProductViewSet(ProductBulkMixin, ProductAnalyticsMixin, ProductComboMixin, ProductStorefrontMixin, UDLEViewSetMixin, TenantModelViewSet):
    permission_classes = [permissions.IsAuthenticated, InventoryReadOnlyOrManage]
    queryset = Product.objects.select_related(
        'brand', 'country', 'category', 'unit', 'parfum', 'size_unit', 'product_group'
    ).all()

    serializer_class = ProductSerializer

    filterset_fields = ['category', 'brand', 'product_type', 'is_active', 'tracks_serials']

    search_fields = ['name', 'sku', 'barcode', 'description']

    ordering_fields = ['name', 'sku', 'selling_price_ttc', 'cost_price', 'stock_level', 'created_at']

    @action(detail=True, methods=['get'])
    def active_operations(self, request, pk=None):
        product = self.get_object()
        operations = []

        # 1. Purchase Orders
        try:
            from apps.pos.models import PurchaseOrderLine
            po_lines = PurchaseOrderLine.objects.filter(
                product=product,
                tenant=product.tenant,
                order__status__in=['SUBMITTED', 'APPROVED', 'ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED']
            ).select_related('order', 'order__supplier', 'order__warehouse', 'order__site', 'warehouse', 'order__rejected_by', 'order__cancelled_by')

            for line in po_lines:
                dest = line.warehouse.name if line.warehouse else (
                    line.order.warehouse.name if line.order.warehouse else (
                        line.order.site.name if line.order.site else 'Default Warehouse'
                    )
                )
                
                failed_by = None
                reason = None
                failure_type = None

                if line.order.status == 'REJECTED':
                    failed_by = f"{line.order.rejected_by.first_name} {line.order.rejected_by.last_name}".strip() if line.order.rejected_by else 'Unknown User'
                    reason = line.order.rejection_reason or 'No reason provided'
                    failure_type = 'INTERNAL_REJECTION'
                elif line.order.status == 'CANCELLED':
                    failed_by = f"{line.order.cancelled_by.first_name} {line.order.cancelled_by.last_name}".strip() if line.order.cancelled_by else 'Unknown User'
                    reason = line.order.cancellation_reason or line.order.notes or 'Supplier cancellation'
                    failure_type = 'SUPPLIER_FAILURE'

                # If it's fully received with ZERO discrepancies, we don't need to show it in the 'Active' pipeline 
                # UNLESS there are active discrepancies we need to flag.
                has_discrepancies = line.qty_missing > 0 or line.qty_damaged > 0 or line.qty_rejected > 0
                if line.order.status == 'RECEIVED' and not has_discrepancies:
                    continue

                discrepancies = {
                    'missing': float(line.qty_missing),
                    'damaged': float(line.qty_damaged),
                    'rejected': float(line.qty_rejected),
                    'notes': line.receipt_notes
                } if has_discrepancies else None

                operations.append({
                    'id': f"po-{line.id}",
                    'type': 'PURCHASE',
                    'status': line.order.status,
                    'reference': line.order.po_number or f"PO-{line.order.id}",
                    'quantity': float(line.quantity - line.qty_received),
                    'source': line.order.supplier.name if line.order.supplier else 'Unknown Supplier',
                    'destination': dest,
                    'date': line.order.created_at.isoformat() if line.order.created_at else None,
                    'failed_by': failed_by,
                    'reason': reason,
                    'failure_type': failure_type,
                    'discrepancies': discrepancies
                })
        except Exception as e:
            pass

        # 2. Strategy Manifests (StockTransferOrder)
        try:
            from apps.inventory.models import StockTransferLine
            manifest_lines = StockTransferLine.objects.filter(
                product=product,
                tenant=product.tenant,
                order__lifecycle_status__in=['OPEN', 'APPROVED', 'CANCELLED']
            ).select_related('order', 'from_warehouse', 'to_warehouse')

            for line in manifest_lines:
                operations.append({
                    'id': f"manifest-{line.id}",
                    'type': 'MANIFEST',
                    'status': line.order.lifecycle_status,
                    'reference': line.order.reference or f"TRF-{line.order.id}",
                    'quantity': float(line.qty_transferred),
                    'source': line.from_warehouse.name if line.from_warehouse else 'Unknown',
                    'destination': line.to_warehouse.name if line.to_warehouse else 'Unknown',
                    'date': line.order.created_at.isoformat() if line.order.created_at else None,
                    'reason': line.order.notes if line.order.lifecycle_status == 'CANCELLED' else None
                })
        except Exception as e:
            pass

        # 3. Execution Transfers (StockMove)
        try:
            from apps.inventory.models import StockMoveLine
            move_lines = StockMoveLine.objects.filter(
                product=product,
                tenant=product.tenant,
                move__status__in=['DRAFT', 'PENDING', 'IN_TRANSIT', 'CANCELLED']
            ).select_related('move', 'move__from_warehouse', 'move__to_warehouse')

            for line in move_lines:
                operations.append({
                    'id': f"move-{line.id}",
                    'type': 'TRANSFER',
                    'status': line.move.status,
                    'reference': line.move.ref_code or f"MOVE-{line.move.id}",
                    'quantity': float(line.quantity - line.quantity_done),
                    'source': line.move.from_warehouse.name if line.move.from_warehouse else 'Unknown',
                    'destination': line.move.to_warehouse.name if line.move.to_warehouse else 'Unknown',
                    'date': line.move.created_at.isoformat() if line.move.created_at else None,
                    'reason': line.move.notes if line.move.status == 'CANCELLED' else None
                })
        except Exception as e:
            pass

        operations.sort(key=lambda x: x['date'] or '', reverse=True)
        return Response(operations)


