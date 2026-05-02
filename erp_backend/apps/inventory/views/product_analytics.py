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


class ProductAnalyticsMixin:

    @action(detail=False, methods=['get'], url_path='data-quality')
    def data_quality(self, request):
        """
        Returns data quality summary for maintenance dashboard.
        """
        organization, err = _get_org_or_400()
        if err: return err

        total = Product.objects.filter(organization=organization, is_active=True)
        missing_barcode = total.filter(Q(barcode__isnull=True) | Q(barcode='')).count()
        missing_category = total.filter(category__isnull=True).count()
        missing_brand = total.filter(brand__isnull=True).count()
        zero_tva = total.filter(tva_rate=0).count()
        zero_cost = total.filter(cost_price_ht=0, cost_price_ttc=0).count()
        zero_selling = total.filter(selling_price_ht=0, selling_price_ttc=0).count()
        missing_name = total.filter(Q(name='') | Q(name__isnull=True)).count()
        total_count = total.count()

        return Response({
            'total_products': total_count,
            'missing_barcode': missing_barcode,
            'missing_category': missing_category,
            'missing_brand': missing_brand,
            'zero_tva': zero_tva,
            'zero_cost_price': zero_cost,
            'zero_selling_price': zero_selling,
            'missing_name': missing_name,
        })


    @action(detail=False, methods=['get'])
    def search_enhanced(self, request):
        """
        PO Intelligence Grid — Dynamic analytics endpoint.
        Uses 3-tier cascade: Global Defaults ← Org Config ← Active Profile Overrides.
        Pass ?page_context=purchase_order to resolve per-page profiles.
        """
        organization, err = _get_org_or_400()
        if err: return err

        # ── Load resolved config (3-tier cascade) ──
        from erp.services import ConfigurationService
        page_context = request.query_params.get('page_context')
        cfg = ConfigurationService.resolve_analytics_config(organization, page_context)

        sales_period = int(cfg.get('sales_avg_period_days', 180)) or 180
        best_price_period = int(cfg.get('best_price_period_days', 180)) or 180
        lead_days = int(cfg.get('proposed_qty_lead_days', 14)) or 14
        safety_mult = float(cfg.get('proposed_qty_safety_multiplier', 1.5)) or 1.5
        score_weights = cfg.get('financial_score_weights', {'margin': 40, 'velocity': 30, 'stock_health': 30})

        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')
        supplier_id = request.query_params.get('supplier_id')
        warehouse_id = request.query_params.get('warehouse_id')
        category_id = request.query_params.get('category')
        brand_id = request.query_params.get('brand')
        stock_scope = request.query_params.get('stock_scope', 'branch')
        limit = int(request.query_params.get('limit', 100))
        offset = int(request.query_params.get('offset', 0))

        products_qs = Product.objects.filter(
            organization=organization, status='ACTIVE'
        ).select_related('brand', 'category', 'unit')
        if query:
            products_qs = products_qs.filter(
                Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)
            )
        if category_id:
            try:
                cat = Category.objects.get(id=category_id, organization=organization)
                descendant_ids = list(Category.objects.filter(
                    organization=organization, parent=cat
                ).values_list('id', flat=True))
                all_cat_ids = [cat.id] + descendant_ids
                grandchild_ids = list(Category.objects.filter(
                    organization=organization, parent_id__in=descendant_ids
                ).values_list('id', flat=True))
                all_cat_ids += grandchild_ids
                products_qs = products_qs.filter(category_id__in=all_cat_ids)
            except Category.DoesNotExist:
                pass
        if brand_id:
            products_qs = products_qs.filter(brand_id=brand_id)

        products_qs = products_qs[offset:offset + limit]
        product_list = list(products_qs)
        product_ids = [p.id for p in product_list]

        if not product_ids:
            return Response([])

        now = timezone.now()

        # ── 1. Stock at location ──
        stock_local_filter = {'organization': organization, 'product_id__in': product_ids}
        if warehouse_id:
            stock_local_filter['warehouse_id'] = warehouse_id
        elif site_id:
            stock_local_filter['warehouse__parent_id'] = site_id
        stock_local_rows = Inventory.objects.filter(**stock_local_filter).values(
            'product_id'
        ).annotate(total_qty=Coalesce(Sum('quantity'), 0, output_field=DecimalField()))
        stock_local_map = {r['product_id']: float(r['total_qty']) for r in stock_local_rows}

        # ── 2. Stock total (all branches) ──
        stock_total_rows = Inventory.objects.filter(
            organization=organization, product_id__in=product_ids
        ).values('product_id').annotate(
            total_qty=Coalesce(Sum('quantity'), 0, output_field=DecimalField())
        )
        stock_total_map = {r['product_id']: float(r['total_qty']) for r in stock_total_rows}

        # ── 3. Stock in transit ──
        transit_rows = InventoryMovement.objects.filter(
            organization=organization, product_id__in=product_ids,
            type='IN', reference__icontains='TRANSFER',
            created_at__gte=now - timedelta(days=30)
        ).values('product_id').annotate(
            total_qty=Coalesce(Sum('quantity'), 0, output_field=DecimalField())
        )
        transit_map = {r['product_id']: float(r['total_qty']) for r in transit_rows}

        # ── 4. Sales velocity (dynamic period) ──
        sales_cutoff = now - timedelta(days=sales_period)
        sales_rows = InventoryMovement.objects.filter(
            organization=organization, product_id__in=product_ids,
            type='OUT', created_at__gte=sales_cutoff
        ).values('product_id').annotate(
            total_out=Coalesce(Sum('quantity'), 0, output_field=DecimalField())
        )
        sales_map = {r['product_id']: float(r['total_out']) for r in sales_rows}

        # ── 4b. Sales windows — sequential time-period breakdown ──
        window_days = int(cfg.get('sales_window_size_days', 15)) or 15
        num_windows = max(1, sales_period // window_days) if sales_period > 0 else 6
        # Build window boundaries: most recent first
        windows = []
        for i in range(num_windows):
            w_end = now - timedelta(days=i * window_days)
            w_start = now - timedelta(days=(i + 1) * window_days)
            windows.append((w_start, w_end))

        # Batch query per window (reverse chronological)
        sales_window_data = {}  # {product_id: [ {start, end, qty}, ... ]}
        for w_start, w_end in windows:
            w_rows = InventoryMovement.objects.filter(
                organization=organization, product_id__in=product_ids,
                type='OUT', created_at__gte=w_start, created_at__lt=w_end
            ).values('product_id').annotate(
                total_out=Coalesce(Sum('quantity'), 0, output_field=DecimalField())
            )
            w_map = {r['product_id']: float(r['total_out']) for r in w_rows}
            for pid in product_ids:
                if pid not in sales_window_data:
                    sales_window_data[pid] = []
                sales_window_data[pid].append({
                    'start': w_start.strftime('%d/%m'),
                    'end': w_end.strftime('%d/%m'),
                    'qty': w_map.get(pid, 0),
                })

        # ── 4c. Trend — compare latest window vs previous ──
        trend_map = {}
        for pid in product_ids:
            wdata = sales_window_data.get(pid, [])
            if len(wdata) >= 2:
                latest = wdata[0]['qty']
                prev = wdata[1]['qty']
                if latest > prev * 1.15:
                    trend_map[pid] = 'UP'
                elif latest < prev * 0.85:
                    trend_map[pid] = 'DOWN'
                else:
                    trend_map[pid] = 'FLAT'
            else:
                trend_map[pid] = 'FLAT'

        # ── 5. PO count + Active PO status (direct queries for reliability) ──
        po_count_map = {}
        direct_po_status_map = {}  # Fallback: direct PO status per product
        try:
            from django.apps import apps as django_apps
            PurchaseOrderLine = django_apps.get_model('pos', 'PurchaseOrderLine')

            # Active PO statuses (not completed, cancelled, or fully received)
            ACTIVE_PO_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED',
                                 'SENT', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED']
            PO_DISPLAY_LABELS = {
                'DRAFT': 'Pending PO', 'SUBMITTED': 'Pending Approval',
                'APPROVED': 'PO Approved', 'REJECTED': 'PO Rejected',
                'SENT': 'Ordered', 'CONFIRMED': 'Ordered',
                'IN_TRANSIT': 'In Transit', 'PARTIALLY_RECEIVED': 'Partially Received',
                'RECEIVED': 'Received',
            }
            PO_PRIORITY = {
                'DRAFT': 2, 'SUBMITTED': 3, 'APPROVED': 4, 'REJECTED': 3,
                'SENT': 5, 'CONFIRMED': 6, 'IN_TRANSIT': 7,
                'PARTIALLY_RECEIVED': 8, 'RECEIVED': 9,
            }

            active_po_lines = PurchaseOrderLine.objects.filter(
                organization=organization,
                product_id__in=product_ids,
                order__status__in=ACTIVE_PO_STATUSES
            ).select_related('order')

            for pol in active_po_lines:
                pid = pol.product_id
                po_count_map[pid] = po_count_map.get(pid, 0) + 1

                # Track highest-priority PO status per product
                po_status = pol.order.status
                priority = PO_PRIORITY.get(po_status, 0)
                existing = direct_po_status_map.get(pid)
                if not existing or priority > existing['priority']:
                    po_ref = pol.order.po_number or f'PO-{pol.order.id}'
                    detail = f"{po_ref} · {int(pol.quantity)} ordered"
                    if pol.qty_received > 0:
                        detail += f" · {int(pol.qty_received)} received"
                    direct_po_status_map[pid] = {
                        'status': PO_DISPLAY_LABELS.get(po_status, 'Ordered'),
                        'detail': detail,
                        'po_number': po_ref,
                        'qty_ordered': float(pol.quantity),
                        'qty_received': float(pol.qty_received),
                        'priority': priority,
                    }
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('search_enhanced: PO count/status query failed', exc_info=e)

        # ── 5b. Procurement status — centralized service (may include request status too) ──
        procurement_status_map = {}
        try:
            from apps.inventory.services.procurement_status_service import get_procurement_status_batch
            procurement_status_map = get_procurement_status_batch(organization, product_ids)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('search_enhanced: procurement service failed', exc_info=e)

        # Merge: direct PO status overrides service if service returned nothing
        for pid in product_ids:
            if pid not in procurement_status_map and pid in direct_po_status_map:
                procurement_status_map[pid] = direct_po_status_map[pid]


        # ── 6. Best supplier pricing (dynamic period) ──
        best_supplier_map = {}
        all_suppliers_map = {}
        try:
            from django.apps import apps as django_apps
            ProductSupplier = django_apps.get_model('pos', 'ProductSupplier')
            SupplierPriceHistory = django_apps.get_model('pos', 'SupplierPriceHistory')

            for ps in ProductSupplier.objects.filter(
                product_id__in=product_ids
            ).select_related('supplier').order_by('product_id', 'last_purchased_price'):
                pid = ps.product_id
                # All suppliers list
                if pid not in all_suppliers_map:
                    all_suppliers_map[pid] = []
                all_suppliers_map[pid].append({
                    'name': ps.supplier.name if ps.supplier else '',
                    'price': float(ps.last_purchased_price) if ps.last_purchased_price else None,
                    'last_date': ps.last_purchased_date.isoformat() if ps.last_purchased_date else None,
                })

                # Best supplier
                if pid not in best_supplier_map:
                    price_query = SupplierPriceHistory.objects.filter(
                        product_id=pid, supplier=ps.supplier
                    ).order_by('-created_at')
                    if best_price_period > 0:
                        price_query = price_query.filter(
                            created_at__gte=now - timedelta(days=best_price_period)
                        )
                    best_entry = price_query.first()
                    best_price = float(best_entry.price) if best_entry else (
                        float(ps.last_purchased_price) if ps.last_purchased_price else None
                    )
                    best_supplier_map[pid] = {'name': ps.supplier.name if ps.supplier else '', 'price': best_price}
        except Exception:
            pass

        # ── 7. Expiry info ──
        expiry_map = {}
        try:
            from django.apps import apps as django_apps
            ProductBatch = django_apps.get_model('inventory', 'ProductBatch')
            batches = ProductBatch.objects.filter(
                product_id__in=product_ids, expiry_date__isnull=False
            ).order_by('product_id', 'expiry_date')
            for b in batches:
                pid = b.product_id
                if pid not in expiry_map:
                    days_left = (b.expiry_date - now.date()).days
                    prod_daily = sales_map.get(pid, 0) / max(sales_period, 1)
                    stock_here = stock_local_map.get(pid, 0)
                    days_to_sell = stock_here / max(prod_daily, 0.01)
                    if days_left < 0:
                        tag = 'RISKY'
                    elif days_to_sell > days_left:
                        tag = 'RISKY'
                    elif days_left < 60:
                        tag = 'CAUTION'
                    else:
                        tag = 'SAFE'
                    expiry_map[pid] = {
                        'nearest_days': days_left,
                        'safety_tag': tag,
                        'expiry_date': b.expiry_date.isoformat(),
                    }
        except Exception:
            pass

        # ── Build response ──
        data = []
        for p in product_list:
            stock_here = stock_local_map.get(p.id, 0)
            stock_total = stock_total_map.get(p.id, 0)
            stock_transit = transit_map.get(p.id, 0)
            total_sold = sales_map.get(p.id, 0)
            daily_sales = total_sold / max(sales_period, 1)
            monthly_avg = daily_sales * 30

            # Proposed qty
            if cfg.get('proposed_qty_formula') == 'MONTHLY_AVG_x_MONTHS':
                months = lead_days / 30.0
                target = monthly_avg * months * safety_mult
            else:
                target = daily_sales * lead_days * safety_mult
            proposed_qty = max(0, int(target - stock_total))

            # Financial score (weighted)
            margin_pct = 0
            if p.cost_price_ht and float(p.cost_price_ht) > 0:
                margin_pct = ((float(p.selling_price_ht) - float(p.cost_price_ht)) / float(p.cost_price_ht)) * 100
            w_m = score_weights.get('margin', 40)
            w_v = score_weights.get('velocity', 30)
            w_h = score_weights.get('stock_health', 30)
            tw = w_m + w_v + w_h or 100
            ms = min(100, max(0, margin_pct * 2))
            vs = min(100, daily_sales * 10)
            hs = 100
            if stock_here < (p.min_stock_level or 0): hs -= 40
            if stock_here == 0: hs -= 30
            financial_score = int((ms * w_m + vs * w_v + hs * w_h) / tw)

            # Status — procurement lifecycle takes priority
            procurement = procurement_status_map.get(p.id)
            product_status = 'Available'
            status_detail = None
            if procurement:
                product_status = procurement['status']
                status_detail = procurement.get('detail', '')
            elif stock_here == 0 and stock_transit > 0:
                product_status = 'In Transit'
                status_detail = f'{int(stock_transit)} in transit'
            elif stock_here == 0:
                product_status = 'Out of Stock'
            elif stock_here < (p.min_stock_level or 0):
                product_status = 'Low Stock'

            best_sup = best_supplier_map.get(p.id, {})
            expiry = expiry_map.get(p.id)

            data.append({
                'id': p.id, 'name': p.name, 'sku': p.sku, 'barcode': p.barcode,
                'imageUrl': p.image_url or '',
                'category_name': p.category.name if p.category else '',
                'brand_name': p.brand.name if p.brand else '',
                'stock_on_location': stock_here,
                'stock_total': stock_total,
                'stock_in_transit': stock_transit,
                'product_status': product_status,
                'status_detail': status_detail,
                'pipeline_status': procurement['status'] if procurement else None,
                'procurement_po': procurement['po_number'] if procurement else None,
                'procurement_qty': procurement['qty_ordered'] if procurement else None,
                'is_active': p.status == 'ACTIVE',
                'avg_daily_sales': round(daily_sales, 2),
                'monthly_average': round(monthly_avg, 2),
                'total_sold_period': round(total_sold, 2),
                'sales_period_days': sales_period,
                'sales_windows': sales_window_data.get(p.id, []),
                'sales_window_size_days': window_days,
                'trend': trend_map.get(p.id, 'FLAT'),
                'proposed_qty': proposed_qty,
                'purchase_count': po_count_map.get(p.id, 0),
                'financial_score': min(100, max(0, financial_score)),
                'adjustment_score': 100,
                'margin_pct': round(margin_pct, 1),
                'cost_price': float(p.cost_price or 0),
                'cost_price_ht': float(p.cost_price_ht or 0),
                'selling_price_ht': float(p.selling_price_ht or 0),
                'selling_price_ttc': float(p.selling_price_ttc or 0),
                'tax_rate': float(getattr(p, 'tva_rate', 0) or 0),
                'best_supplier_name': best_sup.get('name', ''),
                'best_supplier_price': best_sup.get('price'),
                'best_price_period_days': best_price_period,
                'available_suppliers': all_suppliers_map.get(p.id, []),
                'is_expiry_tracked': getattr(p, 'is_expiry_tracked', False) or False,
                'expiry_info': expiry,
                'safety_tag': expiry['safety_tag'] if expiry else 'SAFE',
                'config_used': {
                    'sales_avg_period_days': sales_period,
                    'best_price_period_days': best_price_period,
                    'proposed_qty_formula': cfg.get('proposed_qty_formula'),
                    'po_count_source': cfg.get('po_count_source'),
                    'sales_window_size_days': window_days,
                },
            })

        return Response(data)


    @action(detail=False, methods=['get'])
    def product_analytics(self, request):
        """
        Returns products enriched with stock, sales metrics, health score,
        and operational request lifecycle status. Uses batch queries.
        """
        organization, err = _get_org_or_400()
        if err:
            return err

        search = request.query_params.get('search', '')
        category_id = request.query_params.get('category') or request.query_params.get('categoryId') or request.query_params.get('category_id')
        brand_id = request.query_params.get('brand') or request.query_params.get('brandId') or request.query_params.get('brand_id')
        warehouse_id = request.query_params.get('warehouse_id') or request.query_params.get('warehouseId')
        limit = min(int(request.query_params.get('limit', 50)), 200)
        offset = int(request.query_params.get('offset', 0))

        products_qs = Product.objects.filter(
            organization=organization, status='ACTIVE'
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
        product_list = list(products_qs.order_by('name')[offset:offset + limit])
        product_ids = [p.id for p in product_list]

        if not product_ids:
            return Response({'products': [], 'total': 0})

        thirty_days_ago = timezone.now() - timedelta(days=30)

        # Batch: Stock
        stock_filter = {'organization': organization, 'product_id__in': product_ids}
        if warehouse_id:
            stock_filter['warehouse_id'] = warehouse_id

        stock_rows = Inventory.objects.filter(**stock_filter).values(
            'product_id'
        ).annotate(total_qty=Coalesce(Sum('quantity'), 0, output_field=DecimalField()))
        stock_map = {r['product_id']: float(r['total_qty']) for r in stock_rows}

        # Batch: Sales
        sales_rows = InventoryMovement.objects.filter(
            organization=organization, product_id__in=product_ids,
            type='OUT', created_at__gte=thirty_days_ago
        ).values('product_id').annotate(total_out=Coalesce(Sum('quantity'), 0, output_field=DecimalField()))
        sales_map = {r['product_id']: float(r['total_out']) for r in sales_rows}

        # Batch: Purchases
        purchase_rows = InventoryMovement.objects.filter(
            organization=organization, product_id__in=product_ids,
            type='IN', created_at__gte=thirty_days_ago
        ).values('product_id').annotate(
            total_in=Coalesce(Sum('quantity'), 0, output_field=DecimalField()),
            total_cost=Coalesce(Sum('cost_price_ht'), 0, output_field=DecimalField()),
            count=Count('id')
        )
        purchase_map = {r['product_id']: {
            'total_in': float(r['total_in']),
            'total_cost': float(r['total_cost']),
            'count': r['count']
        } for r in purchase_rows}

        # Batch: Latest operational request
        latest_request_lines = OperationalRequestLine.objects.filter(
            product_id__in=product_ids,
            request__tenant=organization
        ).select_related('request').order_by('product_id', '-request__created_at')

        request_map = {}
        for line in latest_request_lines:
            pid = line.product_id
            if pid not in request_map:
                req = line.request
                request_map[pid] = {
                    'status': req.status,
                    'type': req.request_type,
                    'priority': req.priority,
                    'request_id': req.id,
                    'order_type': req.converted_to_type,
                    'order_id': req.converted_to_id,
                    'rejection_reason': req.rejection_reason
                }

        # Batch: Centralized procurement status
        from apps.inventory.services.procurement_status_service import (
            get_procurement_status_batch, get_product_display_status
        )
        procurement_status_map = get_procurement_status_batch(organization, product_ids)

        results = []
        for p in product_list:
            total_stock = stock_map.get(p.id, 0.0)
            total_sold = sales_map.get(p.id, 0.0)
            purch = purchase_map.get(p.id, {'total_in': 0, 'total_cost': 0, 'count': 0})

            avg_daily = round(total_sold / 30.0, 2)
            avg_monthly = round(total_sold, 2)
            avg_unit_cost = round(purch['total_cost'] / (purch['total_in'] or 1.0), 2)
            stock_days = round(total_stock / (avg_daily or 0.01), 1)

            health = 100
            if total_stock < p.min_stock_level: health -= 30
            if total_stock == 0: health -= 40

            req_info = request_map.get(p.id)
            procurement = procurement_status_map.get(p.id)
            display_status, status_detail = get_product_display_status(
                procurement, total_stock, 0, p.min_stock_level
            )

            results.append({
                'id': p.id,
                'sku': p.sku,
                'barcode': p.barcode,
                'name': p.name,
                'category_name': p.category.name if p.category else None,
                'brand_name': p.brand.name if p.brand else None,
                'unit_code': p.unit.code if p.unit else None,
                'total_stock': total_stock,
                'min_stock_level': p.min_stock_level,
                'cost_price': float(p.cost_price),
                'selling_price_ttc': float(p.selling_price_ttc),
                'avg_daily_sales': avg_daily,
                'avg_monthly_sales': avg_monthly,
                'total_sold_30d': total_sold,
                'total_purchased_30d': purch['total_in'],
                'avg_unit_cost': avg_unit_cost,
                'health_score': max(0, health),
                'stock_days_remaining': stock_days,
                # Unified procurement status
                'product_status': display_status,
                'status_detail': status_detail,
                'pipeline_status': procurement['status'] if procurement else None,
                'procurement_detail': procurement.get('detail') if procurement else None,
                'procurement_po': procurement.get('po_number') if procurement else None,
                # Legacy request fields (backward compat)
                'request_status': req_info['status'] if req_info else None,
                'request_type': req_info['type'] if req_info else None,
                'request_id': req_info['request_id'] if req_info else None,
                'request_priority': req_info['priority'] if req_info else None,
                'order_type': req_info['order_type'] if req_info else None,
                'order_id': req_info['order_id'] if req_info else None,
                'rejection_reason': req_info['rejection_reason'] if req_info else None,
            })

        return Response({'products': results, 'total': total_count})


    @action(detail=True, methods=['get'])
    def intelligence(self, request, pk=None):
        """
        Deep Product Intelligence for Unified Document Engine Sidebar.
        Provides real-time stock, sales velocity, financial scores, and waste alerts.
        """
        product = self.get_object()
        organization = product.organization
        thirty_days_ago = timezone.now() - timedelta(days=30)

        stock_summary = Inventory.objects.filter(product=product).aggregate(
            total=Coalesce(Sum('quantity'), 0, output_field=DecimalField())
        )
        stock_by_loc = list(Inventory.objects.filter(product=product).values(
            'warehouse__id', 'warehouse__name'
        ).annotate(qty=Sum('quantity')))

        sales_data = InventoryMovement.objects.filter(
            product=product, type='OUT', created_at__gte=thirty_days_ago
        ).aggregate(
            total_qty=Coalesce(Sum('quantity'), 0, output_field=DecimalField()),
            count=Count('id')
        )
        total_sales_30d = float(sales_data['total_qty'])
        avg_daily_sales = total_sales_30d / 30.0

        from django.apps import apps
        try:
            ProductSupplier = apps.get_model('pos', 'ProductSupplier')
        except LookupError:
            ProductSupplier = None

        if ProductSupplier:
            all_suppliers = list(ProductSupplier.objects.filter(
                product=product
            ).select_related('supplier').order_by('last_purchased_price'))
            best_supplier = all_suppliers[0] if all_suppliers else None
        else:
            all_suppliers = []
            best_supplier = None

        sourcing_info = {
            'best_supplier': best_supplier.supplier.name if best_supplier else None,
            'best_price': float(best_supplier.last_purchased_price) if best_supplier else None,
            'last_purchased': best_supplier.last_purchased_date if best_supplier else None,
            'available_suppliers': [{
                'name': ps.supplier.name,
                'price': float(ps.last_purchased_price) if ps.last_purchased_price else None,
                'last_date': ps.last_purchased_date,
            } for ps in all_suppliers],
        }

        margin = 0
        if product.cost_price_ht > 0:
            margin = ((product.selling_price_ht - product.cost_price_ht) / product.cost_price_ht) * 100

        financial_score = 50
        if margin > 30: financial_score += 20
        if avg_daily_sales > 10: financial_score += 20
        if margin < 10 and avg_daily_sales < 1: financial_score -= 30

        expiry_risk = []
        batches = Inventory.objects.filter(product=product, quantity__gt=0).select_related('batch')
        for inv in batches:
            if inv.batch and inv.batch.expiry_date:
                days_until_expiry = (inv.batch.expiry_date - timezone.now().date()).days
                effective_sales = max(0.01, avg_daily_sales)
                days_of_stock = float(inv.quantity) / effective_sales

                if days_of_stock > days_until_expiry:
                    waste_qty = float(inv.quantity) - (effective_sales * max(0, days_until_expiry))
                    expiry_risk.append({
                        'batch': inv.batch.batch_number,
                        'expiry': inv.batch.expiry_date,
                        'waste_risk_qty': round(waste_qty, 2),
                        'days_until_expiry': days_until_expiry,
                        'severity': 'HIGH' if days_until_expiry < 30 else 'MEDIUM'
                    })

        return Response({
            'id': product.id,
            'sku': product.sku,
            'name': product.name,
            'stock': {
                'total': float(stock_summary['total']),
                'by_location': stock_by_loc
            },
            'sales': {
                'total_30d': total_sales_30d,
                'avg_daily': round(avg_daily_sales, 2),
                'monthly_avg': total_sales_30d,
            },
            'sourcing': sourcing_info,
            'financials': {
                'score': min(100, max(0, financial_score)),
                'margin_pct': float(margin),
                'adjustment_score': 100,
            },
            'expiry_risk': expiry_risk,
            'status': product.status
        })

