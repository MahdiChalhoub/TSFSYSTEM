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


class InventoryViewSet(TenantModelViewSet):
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

        from apps.inventory.advanced_models import ExpiryAlert
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
        from apps.inventory.advanced_models import ExpiryAlert
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

        from erp.models import Site
        from erp.serializers import SiteSerializer
        sites = Site.objects.filter(organization=organization, is_active=True)
        product_ids = [p.id for p in products_qs]

        stock_rows = Inventory.objects.filter(
            organization=organization,
            product_id__in=product_ids,
        ).select_related('warehouse').values(
            'product_id', 'warehouse__site_id'
        ).annotate(total_qty=Sum('quantity'))

        stock_map = {}
        for row in stock_rows:
            pid = row['product_id']
            sid = row['warehouse__site_id']
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
            "sites": SiteSerializer(sites, many=True).data,
            "totalCount": total_count
        })


class InventoryMovementViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = InventoryMovement.objects.select_related('product', 'warehouse').all()
    serializer_class = InventoryMovementSerializer
    http_method_names = ['get', 'head', 'options']
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


class StockAdjustmentOrderViewSet(LifecycleViewSetMixin, TenantModelViewSet):
    queryset = StockAdjustmentOrder.objects.select_related(
        'warehouse', 'supplier', 'created_by', 'locked_by'
    ).prefetch_related('lines__product', 'lines__warehouse', 'lines__added_by').all()
    serializer_class = StockAdjustmentOrderSerializer
    lifecycle_transaction_type = 'STOCK_ADJUSTMENT'

    def get_queryset(self):
        qs = super().get_queryset()
        lifecycle_status = self.request.query_params.get('status')
        warehouse_id = self.request.query_params.get('warehouse')
        if lifecycle_status:
            qs = qs.filter(lifecycle_status=lifecycle_status)
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        return qs

    def perform_create(self, serializer):
        from apps.finance.models import TransactionSequence
        org_id = get_current_tenant_id()
        org = Organization.objects.get(id=org_id)
        ref = TransactionSequence.next_value(org, 'STOCK_ADJ')
        serializer.save(
            organization=org,
            created_by=self.request.user,
            reference=ref
        )

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        order = self.get_object()
        if not order.is_editable:
            return Response({'error': 'Order is not editable (locked/verified)'}, status=400)
        try:
            line = StockAdjustmentLine.objects.create(
                order=order,
                product_id=request.data['product'],
                qty_adjustment=request.data['qty_adjustment'],
                amount_adjustment=request.data.get('amount_adjustment', 0),
                warehouse_id=request.data.get('warehouse', order.warehouse_id),
                reason=request.data.get('reason', ''),
                recovered_amount=request.data.get('recovered_amount', 0),
                reflect_transfer_id=request.data.get('reflect_transfer'),
                added_by=request.user,
            )
            self._update_totals(order)
            return Response(StockAdjustmentLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['delete'], url_path='remove_line/(?P<line_id>[0-9]+)')
    def remove_line(self, request, pk=None, line_id=None):
        order = self.get_object()
        if not order.is_editable:
            return Response({'error': 'Order is not editable'}, status=400)
        try:
            StockAdjustmentLine.objects.filter(id=line_id, order=order).delete()
            self._update_totals(order)
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def post_order(self, request, pk=None):
        order = self.get_object()
        if order.lifecycle_status != 'CONFIRMED' and order.status != 'CONFIRMED':
            return Response({'error': 'Order must be CONFIRMED before posting'}, status=400)
        if order.is_posted:
            return Response({'error': 'Order already posted'}, status=400)

        try:
            InventoryService.process_adjustment_order(
                organization=order.organization,
                order=order,
                user=request.user
            )
            return Response({'message': f'Posted {order.lines.count()} adjustments successfully.'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    def _update_totals(self, order):
        agg = order.lines.aggregate(
            total_qty=Sum('qty_adjustment'),
            total_amt=Sum('amount_adjustment')
        )
        order.total_qty_adjustment = agg['total_qty'] or 0
        order.total_amount_adjustment = agg['total_amt'] or 0
        order.save(update_fields=['total_qty_adjustment', 'total_amount_adjustment'])


class StockTransferOrderViewSet(LifecycleViewSetMixin, TenantModelViewSet):
    queryset = StockTransferOrder.objects.select_related(
        'from_warehouse', 'to_warehouse', 'supplier', 'created_by', 'locked_by'
    ).prefetch_related('lines__product', 'lines__from_warehouse', 'lines__to_warehouse', 'lines__added_by').all()
    serializer_class = StockTransferOrderSerializer
    lifecycle_transaction_type = 'STOCK_TRANSFER'

    def get_queryset(self):
        qs = super().get_queryset()
        lifecycle_status = self.request.query_params.get('status')
        from_wh = self.request.query_params.get('from_warehouse')
        to_wh = self.request.query_params.get('to_warehouse')
        if lifecycle_status:
            qs = qs.filter(lifecycle_status=lifecycle_status)
        if from_wh:
            qs = qs.filter(from_warehouse_id=from_wh)
        if to_wh:
            qs = qs.filter(to_warehouse_id=to_wh)
        return qs

    def perform_create(self, serializer):
        from apps.finance.models import TransactionSequence
        org_id = get_current_tenant_id()
        org = Organization.objects.get(id=org_id)
        ref = TransactionSequence.next_value(org, 'STOCK_TRF')
        serializer.save(
            organization=org,
            created_by=self.request.user,
            reference=ref
        )

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        order = self.get_object()
        if not order.is_editable:
            return Response({'error': 'Order is not editable (locked/verified)'}, status=400)
        try:
            line = StockTransferLine.objects.create(
                order=order,
                product_id=request.data['product'],
                qty_transferred=request.data['qty_transferred'],
                from_warehouse_id=request.data.get('from_warehouse', order.from_warehouse_id),
                to_warehouse_id=request.data.get('to_warehouse', order.to_warehouse_id),
                reason=request.data.get('reason', ''),
                recovered_amount=request.data.get('recovered_amount', 0),
                added_by=request.user,
            )
            self._update_totals(order)
            return Response(StockTransferLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['delete'], url_path='remove_line/(?P<line_id>[0-9]+)')
    def remove_line(self, request, pk=None, line_id=None):
        order = self.get_object()
        if not order.is_editable:
            return Response({'error': 'Order is not editable'}, status=400)
        try:
            StockTransferLine.objects.filter(id=line_id, order=order).delete()
            self._update_totals(order)
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def post_order(self, request, pk=None):
        order = self.get_object()
        if order.lifecycle_status != 'CONFIRMED' and order.status != 'CONFIRMED':
            return Response({'error': 'Order must be CONFIRMED before posting'}, status=400)
        if order.is_posted:
            return Response({'error': 'Order already posted'}, status=400)

        try:
            InventoryService.process_transfer_order(
                organization=order.organization,
                order=order,
                user=request.user
            )
            return Response({'message': f'Posted {order.lines.count()} transfers successfully.'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    def _update_totals(self, order):
        agg = order.lines.aggregate(total_qty=Sum('qty_transferred'))
        order.total_qty_transferred = agg['total_qty'] or 0
        order.save(update_fields=['total_qty_transferred'])


class OperationalRequestViewSet(TenantModelViewSet):
    queryset = OperationalRequest.objects.select_related(
        'requested_by', 'approved_by'
    ).prefetch_related('lines__product', 'lines__warehouse').all()
    serializer_class = OperationalRequestSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        req_type = self.request.query_params.get('type')
        req_status = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        if req_type:
            qs = qs.filter(request_type=req_type)
        if req_status:
            qs = qs.filter(status=req_status)
        if priority:
            qs = qs.filter(priority=priority)
        return qs

    def perform_create(self, serializer):
        from apps.finance.models import TransactionSequence
        org_id = get_current_tenant_id()
        org = Organization.objects.get(id=org_id)
        ref = TransactionSequence.next_value(org, 'OP_REQ')
        serializer.save(
            organization=org,
            requested_by=self.request.user,
            reference=ref
        )

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        req = self.get_object()
        if req.status not in ('PENDING', 'APPROVED'):
            return Response({'error': 'Cannot add lines to this request'}, status=400)
        try:
            line = OperationalRequestLine.objects.create(
                request=req,
                product_id=request.data['product'],
                quantity=request.data['quantity'],
                warehouse_id=request.data.get('warehouse'),
                reason=request.data.get('reason', ''),
            )
            return Response(OperationalRequestLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response({'error': 'Only PENDING requests can be approved'}, status=400)
        req.status = 'APPROVED'
        req.approved_by = request.user
        req.approved_at = timezone.now()
        req.save(update_fields=['status', 'approved_by', 'approved_at'])
        return Response(OperationalRequestSerializer(req).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response({'error': 'Only PENDING requests can be rejected'}, status=400)
        req.status = 'REJECTED'
        req.rejection_reason = request.data.get('reason', '')
        req.save(update_fields=['status', 'rejection_reason'])
        return Response(OperationalRequestSerializer(req).data)

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        req = self.get_object()
        if req.status != 'APPROVED':
            return Response({'error': 'Only APPROVED requests can be converted'}, status=400)

        from apps.finance.models import TransactionSequence
        organization = req.organization
        lines = req.lines.all()

        if req.request_type == 'STOCK_ADJUSTMENT':
            warehouse_id = request.data.get('warehouse')
            if not warehouse_id and lines.exists():
                warehouse_id = lines.first().warehouse_id
            if not warehouse_id:
                return Response({'error': 'warehouse is required for adjustment orders'}, status=400)

            ref = TransactionSequence.next_value(organization, 'STOCK_ADJ')
            order = StockAdjustmentOrder.objects.create(
                organization=organization,
                reference=ref,
                date=timezone.now().date(),
                warehouse_id=warehouse_id,
                reason=req.description or '',
                created_by=request.user,
            )
            for line in lines:
                StockAdjustmentLine.objects.create(
                    order=order,
                    product=line.product,
                    qty_adjustment=line.quantity,
                    warehouse_id=line.warehouse_id or warehouse_id,
                    reason=line.reason or '',
                    added_by=request.user,
                )
            req.converted_to_type = 'stock_adjustment'
            req.converted_to_id = order.pk

        elif req.request_type == 'STOCK_TRANSFER':
            from_wh = request.data.get('from_warehouse')
            to_wh = request.data.get('to_warehouse')
            if not from_wh or not to_wh:
                return Response({'error': 'from_warehouse and to_warehouse required'}, status=400)

            ref = TransactionSequence.next_value(organization, 'STOCK_TRF')
            order = StockTransferOrder.objects.create(
                organization=organization,
                reference=ref,
                date=timezone.now().date(),
                from_warehouse_id=from_wh,
                to_warehouse_id=to_wh,
                reason=req.description or '',
                created_by=request.user,
            )
            for line in lines:
                StockTransferLine.objects.create(
                    order=order,
                    product=line.product,
                    qty_transferred=line.quantity,
                    from_warehouse_id=from_wh,
                    to_warehouse_id=to_wh,
                    reason=line.reason or '',
                    added_by=request.user,
                )
            req.converted_to_type = 'stock_transfer'
            req.converted_to_id = order.pk

        else:
            return Response({'error': f'Conversion for {req.request_type} not yet supported'}, status=400)

        req.status = 'CONVERTED'
        req.save(update_fields=['status', 'converted_to_type', 'converted_to_id'])
        return Response({
            'message': f'Request converted to {req.converted_to_type} #{req.converted_to_id}',
            'order_id': req.converted_to_id,
            'order_type': req.converted_to_type,
        })


class ProductSerialViewSet(TenantModelViewSet):
    queryset = ProductSerial.objects.all()
    serializer_class = ProductSerialSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get('product_id')
        serial_number = self.request.query_params.get('serial_number')
        if product_id:
            qs = qs.filter(product_id=product_id)
        if serial_number:
            qs = qs.filter(serial_number__icontains=serial_number)
        return qs

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        serial = self.get_object()
        logs = serial.logs.all()
        from apps.inventory.serializers import SerialLogSerializer
        serializer = SerialLogSerializer(logs, many=True)
        return Response(serializer.data)


class SerialLogViewSet(TenantModelViewSet):
    queryset = SerialLog.objects.all()
    serializer_class = SerialLogSerializer


from apps.inventory.alert_models import StockAlert, StockAlertService
from apps.inventory.serializers import StockAlertSerializer


class StockAlertViewSet(TenantModelViewSet):
    queryset = StockAlert.objects.select_related(
        'product', 'warehouse', 'acknowledged_by', 'purchase_order'
    ).all()
    serializer_class = StockAlertSerializer
    filterset_fields = ['alert_type', 'severity', 'status', 'product']
    search_fields = ['product__name', 'product__sku', 'message']
    ordering_fields = ['created_at', 'severity', 'current_stock']

    def get_queryset(self):
        qs = super().get_queryset()
        alert_status = self.request.query_params.get('status')
        alert_type = self.request.query_params.get('alert_type')
        severity = self.request.query_params.get('severity')
        if alert_status:
            qs = qs.filter(status=alert_status)
        if alert_type:
            qs = qs.filter(alert_type=alert_type)
        if severity:
            qs = qs.filter(severity=severity)
        return qs

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        if alert.status != 'ACTIVE':
            return Response({'error': 'Only ACTIVE alerts can be acknowledged'}, status=400)
        alert.acknowledge(request.user)
        return Response(StockAlertSerializer(alert).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        if alert.status in ('RESOLVED',):
            return Response({'error': 'Alert already resolved'}, status=400)
        alert.resolve(note=request.data.get('note', ''))
        return Response(StockAlertSerializer(alert).data)

    @action(detail=True, methods=['post'])
    def snooze(self, request, pk=None):
        alert = self.get_object()
        until = request.data.get('until')
        if not until:
            return Response({'error': 'until datetime required'}, status=400)
        from django.utils.dateparse import parse_datetime
        dt = parse_datetime(until)
        if not dt:
            return Response({'error': 'Invalid datetime format'}, status=400)
        alert.snooze(dt)
        return Response(StockAlertSerializer(alert).data)

    @action(detail=False, methods=['post'], url_path='scan-all')
    def scan_all(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=400)
        org = Organization.objects.get(id=organization_id)
        service = StockAlertService(org)
        alerts = service.scan_all()
        return Response({
            'message': f'Scan complete. {len(alerts)} new alerts created.',
            'new_alerts': StockAlertSerializer(alerts, many=True).data,
        })

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=400)

        from django.db.models import Count
        qs = StockAlert.objects.filter(organization_id=organization_id)

        stats = {
            'total': qs.count(),
            'by_status': dict(qs.values_list('status').annotate(c=Count('id')).values_list('status', 'c')),
            'by_type': dict(qs.values_list('alert_type').annotate(c=Count('id')).values_list('alert_type', 'c')),
            'by_severity': dict(qs.values_list('severity').annotate(c=Count('id')).values_list('severity', 'c')),
            'active_critical': qs.filter(status='ACTIVE', severity='CRITICAL').count(),
            'active_warning': qs.filter(status='ACTIVE', severity='WARNING').count(),
        }
        return Response(stats)
