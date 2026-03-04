from apps.inventory.models import (
    Inventory,
    InventoryMovement,
    OperationalRequest,
    OperationalRequestLine,
    Product,
    ProductGroup,
    ProductSerial,
    SerialLog,
    StockAdjustmentLine,
    StockAdjustmentOrder,
    StockTransferLine,
    StockTransferOrder,
    Warehouse,
)
from apps.inventory.serializers import (
    InventoryMovementSerializer,
    InventorySerializer,
    OperationalRequestLineSerializer,
    OperationalRequestSerializer,
    ProductGroupSerializer,
    ProductSerialSerializer,
    SerialLogSerializer,
    StockAdjustmentLineSerializer,
    StockAdjustmentOrderSerializer,
    StockTransferLineSerializer,
    StockTransferOrderSerializer,
)
from apps.inventory.services import InventoryService
from .base import (
    F,
    Organization,
    Q,
    Response,
    Sum,
    TenantModelViewSet,
    _get_org_or_400,
    action,
    get_current_tenant_id,
    status,
    timezone,
)
from erp.mixins import UDLEViewSetMixin
from erp.lifecycle_mixin import LifecycleViewSetMixin
from apps.inventory.models import StockAlert, StockAlertService
from apps.inventory.serializers import StockAlertSerializer
from apps.inventory.models import StockAlert, StockAlertService
from apps.inventory.serializers import StockAlertSerializer
from rest_framework import permissions
from erp.permissions import InventoryReadOnlyOrManage, permission_required



class InventoryViewSet(TenantModelViewSet):
    permission_classes = [permissions.IsAuthenticated, InventoryReadOnlyOrManage]
    queryset = Inventory.objects.select_related('product', 'warehouse').all()
    serializer_class = InventorySerializer

    @action(detail=False, methods=['get'], url_path='available-consignment')
    def available_consignment(self, request):
        """Returns current inventory items that are marked as consignment."""
        organization_id = get_current_tenant_id()
        stock = Inventory.objects.filter(
            organization_id=organization_id,
            is_consignment=True,
            quantity__gt=0
        ).select_related('product', 'warehouse', 'supplier')

        data = [{
            'id': inv.id,
            'product_name': inv.product.name,
            'sku': inv.product.sku,
            'warehouse_name': inv.warehouse.name,
            'quantity': inv.quantity,
            'supplier_name': inv.supplier.name if inv.supplier else 'Unknown',
            'consignment_cost': inv.consignment_cost,
        } for inv in stock]

        return Response(data)

    # --- H4: cross-tenant validation ---
    @action(detail=False, methods=['post'])
    @permission_required('inventory.manage')
    def receive_stock(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            product = Product.objects.get(
                id=request.data.get('product_id'), organization=organization
            )
            warehouse = Warehouse.objects.get(
                id=request.data.get('warehouse_id'), organization=organization
            )

            InventoryService.receive_stock(
                organization=organization,
                product=product,
                warehouse=warehouse,
                quantity=request.data.get('quantity'),
                cost_price_ht=request.data.get('cost_price_ht'),
                reference=request.data.get('reference', 'RECEPTION')
            )
            return Response({"message": "Stock received"}, status=status.HTTP_201_CREATED)
        except (Product.DoesNotExist, Warehouse.DoesNotExist) as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    @permission_required('inventory.adjust')
    def adjust_stock(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            product = Product.objects.get(
                id=request.data.get('product_id'), organization=organization
            )
            warehouse = Warehouse.objects.get(
                id=request.data.get('warehouse_id'), organization=organization
            )

            InventoryService.adjust_stock(
                organization=organization,
                product=product,
                warehouse=warehouse,
                quantity=request.data.get('quantity'),
                reason=request.data.get('reason'),
                reference=request.data.get('reference')
            )
            return Response({"message": "Stock adjusted"}, status=status.HTTP_201_CREATED)
        except (Product.DoesNotExist, Warehouse.DoesNotExist) as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def valuation(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        status_data = InventoryService.get_inventory_valuation(organization)
        return Response(status_data)

    @action(detail=False, methods=['get'], url_path='stock-valuation')
    def stock_valuation(self, request):
        """Per-product stock valuation using FIFO/LIFO/Weighted Average."""
        organization, err = _get_org_or_400()
        if err: return err

        warehouse_id = request.query_params.get('warehouse_id')
        try:
            products = InventoryService.get_stock_valuation_summary(
                organization=organization,
                warehouse_id=request.query_params.get('warehouse_id')
            )

            total_qty = sum(p['quantity'] for p in products)
            total_value = sum(p['total_value'] for p in products)

            return Response({
                'summary': {
                    'total_products': len(products),
                    'total_quantity': total_qty,
                    'total_value': total_value,
                },
                'products': products,
            })
        except Exception:
            inventories = Inventory.objects.filter(
                organization=organization,
                quantity__gt=0,
            ).select_related('product', 'warehouse').annotate(
                item_value=F('quantity') * F('product__cost_price')
            )

            products = [{
                'product_id': inv.product.id,
                'product_name': inv.product.name,
                'product_sku': getattr(inv.product, 'barcode', None),
                'quantity': float(inv.quantity),
                'total_value': float(inv.item_value or 0),
                'avg_cost': float(inv.product.cost_price) if inv.product.cost_price else 0,
                'method': 'COST_PRICE',
                'warehouse': inv.warehouse.name if inv.warehouse else None,
            } for inv in inventories]

            total_qty = sum(p['quantity'] for p in products)
            total_value = sum(p['total_value'] for p in products)

            return Response({
                'summary': {
                    'total_products': len(products),
                    'total_quantity': total_qty,
                    'total_value': total_value,
                },
                'products': products,
            })

    @action(detail=False, methods=['get'])
    def financial_status(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        status_data = InventoryService.get_inventory_financial_status(organization)
        return Response(status_data)

    @action(detail=False, methods=['get'], url_path='expiry-alerts')
    def expiry_alerts(self, request):
        """List all expiry alerts, optionally filterd by severity."""
        organization, err = _get_org_or_400()
        if err: return err

        from apps.inventory.models import ExpiryAlert
        severity = request.query_params.get('severity')
        show_acknowledged = request.query_params.get('acknowledged', 'false').lower() == 'true'

        qs = ExpiryAlert.objects.filter(organization=organization)
        if not show_acknowledged:
            qs = qs.filter(is_acknowledged=False)
        if severity:
            qs = qs.filter(severity=severity)

        qs = qs.select_related('product', 'batch', 'batch__warehouse')

        alerts = [{
            'id': a.id,
            'severity': a.severity,
            'product_name': a.product.name if a.product else 'Unknown',
            'product_id': a.product_id,
            'batch_number': a.batch.batch_number if a.batch else '—',
            'expiry_date': str(a.batch.expiry_date) if a.batch and a.batch.expiry_date else None,
            'days_until_expiry': a.days_until_expiry,
            'quantity_at_risk': float(a.quantity_at_risk),
            'value_at_risk': float(a.value_at_risk),
            'warehouse': a.batch.warehouse.name if a.batch and a.batch.warehouse else None,
            'is_acknowledged': a.is_acknowledged,
            'created_at': str(a.created_at) if a.created_at else None,
        } for a in qs[:100]]

        from django.db.models import Count, Sum
        stats = ExpiryAlert.objects.filter(
            organization=organization, is_acknowledged=False
        ).aggregate(
            expired=Count('id', filter=Q(severity='EXPIRED')),
            critical=Count('id', filter=Q(severity='CRITICAL')),
            warning=Count('id', filter=Q(severity='WARNING')),
            total_value=Sum('value_at_risk'),
            total_qty=Sum('quantity_at_risk'),
        )

        return Response({
            'stats': {
                'expired': stats['expired'] or 0,
                'critical': stats['critical'] or 0,
                'warning': stats['warning'] or 0,
                'total_value': float(stats['total_value'] or 0),
                'total_quantity': float(stats['total_qty'] or 0),
            },
            'alerts': alerts,
        })

    @action(detail=False, methods=['post'], url_path='scan-expiry')
    def scan_expiry(self, request):
        """Trigger a scan to generate/update expiry alerts."""
        organization, err = _get_org_or_400()
        if err: return err

        alerts = InventoryService.check_expiry_alerts(organization)
        return Response({
            'new_alerts_created': len(alerts),
        })

    @action(detail=True, methods=['post'], url_path='acknowledge-expiry/(?P<alert_id>[^/.]+)')
    def acknowledge_expiry(self, request, pk=None, alert_id=None):
        organization, err = _get_org_or_400()
        if err: return err
        from apps.inventory.models import ExpiryAlert
        try:
            alert = ExpiryAlert.objects.get(id=alert_id, organization=organization)
            alert.is_acknowledged = True
            alert.acknowledged_by = request.user if request.user.is_authenticated else None
            alert.save()
            return Response({"message": "Alert acknowledged"})
        except ExpiryAlert.DoesNotExist:
            return Response({"error": "Alert not found"}, status=404)

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        """Products where current stock is at or below min_stock_level."""
        organization, err = _get_org_or_400()
        if err: return err

        products = Product.objects.filter(
            organization=organization, is_active=True
        )

        alerts = []
        for product in products:
            total_qty = Inventory.objects.filter(
                organization=organization, product=product
            ).aggregate(total=Sum('quantity'))['total'] or 0

            if total_qty <= product.min_stock_level:
                shortage = product.min_stock_level - float(total_qty)
                alerts.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'barcode': getattr(product, 'barcode', None),
                    'current_stock': float(total_qty),
                    'min_stock_level': product.min_stock_level,
                    'shortage': shortage,
                    'severity': 'OUT' if total_qty == 0 else ('CRITICAL' if total_qty <= product.min_stock_level * 0.3 else 'LOW'),
                    'cost_price': float(product.cost_price) if product.cost_price else 0,
                    'restock_value': shortage * float(product.cost_price) if product.cost_price else 0,
                })

        sev_order = {'OUT': 0, 'CRITICAL': 1, 'LOW': 2}
        alerts.sort(key=lambda a: (sev_order.get(a['severity'], 3), -a['shortage']))

        out_count = sum(1 for a in alerts if a['severity'] == 'OUT')
        critical_count = sum(1 for a in alerts if a['severity'] == 'CRITICAL')
        low_count = sum(1 for a in alerts if a['severity'] == 'LOW')
        total_restock = sum(a['restock_value'] for a in alerts)

        return Response({
            'stats': {
                'total_alerts': len(alerts),
                'out_of_stock': out_count,
                'critical': critical_count,
                'low': low_count,
                'total_restock_value': total_restock,
            },
            'products': alerts,
        })

    @action(detail=False, methods=['post'])
    @permission_required('inventory.transfer')
    def transfer_stock(self, request):
        """Transfer stock between warehouses within the same organization."""
        organization, err = _get_org_or_400()
        if err: return err

        try:
            product = Product.objects.get(
                id=request.data.get('product_id'), organization=organization
            )
            source_warehouse = Warehouse.objects.get(
                id=request.data.get('source_warehouse_id'), organization=organization
            )
            destination_warehouse = Warehouse.objects.get(
                id=request.data.get('destination_warehouse_id'), organization=organization
            )

            result = InventoryService.transfer_stock(
                organization=organization,
                product=product,
                source_warehouse=source_warehouse,
                destination_warehouse=destination_warehouse,
                quantity=request.data.get('quantity'),
                reference=request.data.get('reference'),
            )
            return Response({
                "message": "Stock transferred successfully",
                **result
            }, status=status.HTTP_201_CREATED)
        except (Product.DoesNotExist, Warehouse.DoesNotExist) as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def viewer(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        search = request.query_params.get('search', '')
        category_id = request.query_params.get('categoryId') or request.query_params.get('category_id') or request.query_params.get('category')
        brand_id = request.query_params.get('brandId') or request.query_params.get('brand_id') or request.query_params.get('brand')
        limit = min(int(request.query_params.get('limit', 50)), 200)
        offset = int(request.query_params.get('offset', 0))

        products_qs = Product.objects.filter(
            organization=organization
        ).select_related('brand', 'category', 'unit')

        if search:
            products_qs = products_qs.filter(
                Q(name__icontains=search) | Q(sku__icontains=search) | Q(barcode__icontains=search)
            )
        if category_id:
            products_qs = products_qs.filter(category_id=category_id)
        if brand_id:
            products_qs = products_qs.filter(brand_id=brand_id)

        total_count = products_qs.count()
        products_qs = products_qs[offset:offset + limit]

        from apps.inventory.serializers import WarehouseSerializer
        # Use BRANCH-type warehouses as "sites" for the viewer
        sites = Warehouse.objects.filter(organization=organization, location_type='BRANCH', is_active=True)
        product_ids = [p.id for p in products_qs]

        stock_rows = Inventory.objects.filter(
            organization=organization,
            product_id__in=product_ids,
        ).select_related('warehouse').values(
            'product_id', 'warehouse__parent_id'
        ).annotate(total_qty=Sum('quantity'))

        stock_map = {}
        for row in stock_rows:
            pid = row['product_id']
            sid = row['warehouse__parent_id']
            qty = float(row['total_qty'] or 0)
            stock_map.setdefault(pid, {})[sid] = stock_map.get(pid, {}).get(sid, 0) + qty

        data = []
        for p in products_qs:
            site_stock = stock_map.get(p.id, {})
            total_qty = sum(site_stock.values())

            for s in sites:
                if s.id not in site_stock:
                    site_stock[s.id] = 0.0

            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "category": p.category.name if p.category else None,
                "brand": p.brand.name if p.brand else None,
                "unit": p.unit.code if p.unit else None,
                "siteStock": site_stock,
                "totalQty": total_qty,
                "costPrice": float(p.cost_price)
            })

        return Response({
            "products": data,
            "sites": WarehouseSerializer(sites, many=True).data,
            "totalCount": total_count
        })


class InventoryMovementViewSet(UDLEViewSetMixin, TenantModelViewSet):
    permission_classes = [permissions.IsAuthenticated, InventoryReadOnlyOrManage]
    queryset = InventoryMovement.objects.select_related('product', 'warehouse').all()
    serializer_class = InventoryMovementSerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    filterset_fields = ['type', 'product', 'warehouse']
    search_fields = ['reference', 'product__name', 'warehouse__name']
    ordering_fields = ['created_at', 'quantity', 'cost_price']

    @action(detail=False, methods=['get'])
    def by_product(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({"error": "product_id required"}, status=400)

        movements = InventoryMovement.objects.filter(
            organization=organization, product_id=product_id
        ).select_related('product', 'warehouse').order_by('-created_at')[:100]

        return Response(InventoryMovementSerializer(movements, many=True).data)
