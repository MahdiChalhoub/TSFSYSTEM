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
        organization, err = _get_org_or_400()
        if err: return err

        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')
        category_id = request.query_params.get('category')
        brand_id = request.query_params.get('brand')
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
            # Include products from the category and all its descendants
            try:
                cat = Category.objects.get(id=category_id, organization=organization)
                descendant_ids = list(Category.objects.filter(
                    organization=organization, parent=cat
                ).values_list('id', flat=True))
                all_cat_ids = [cat.id] + descendant_ids
                # Also grab grandchildren
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

        thirty_days_ago = timezone.now() - timedelta(days=30)

        # Batch: Stock (1 query instead of N)
        stock_filter = {'organization': organization, 'product_id__in': product_ids}
        if site_id:
            stock_filter['warehouse__parent_id'] = site_id
        stock_rows = Inventory.objects.filter(**stock_filter).values(
            'product_id'
        ).annotate(total_qty=Coalesce(Sum('quantity'), 0, output_field=DecimalField()))
        stock_map = {r['product_id']: float(r['total_qty']) for r in stock_rows}

        # Batch: Sales velocity (1 query instead of N)
        sales_rows = InventoryMovement.objects.filter(
            organization=organization, product_id__in=product_ids,
            type='OUT', created_at__gte=thirty_days_ago
        ).values('product_id').annotate(
            total_out=Coalesce(Sum('quantity'), 0, output_field=DecimalField())
        )
        sales_map = {r['product_id']: float(r['total_out']) for r in sales_rows}

        data = []
        for p in product_list:
            stock_level = stock_map.get(p.id, 0.0)
            total_out = sales_map.get(p.id, 0.0)
            daily_sales = total_out / 30.0

            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "imageUrl": p.image_url or '',
                "brandName": p.brand.name if p.brand else '',
                "brandId": p.brand_id,
                "categoryName": p.category.name if p.category else '',
                "categoryId": p.category_id,
                "costPrice": float(p.cost_price),
                "costPriceHT": float(p.cost_price_ht),
                "sellingPriceHT": float(p.selling_price_ht),
                "sellingPriceTTC": float(p.selling_price_ttc),
                "basePrice": float(p.selling_price_ttc),
                "price": float(p.selling_price_ttc),
                "taxRate": float(getattr(p, 'tva_rate', 0) or 0),
                "isTaxIncluded": True,
                "stockLevel": stock_level,
                "stock": stock_level,
                "dailySales": round(daily_sales, 2),
                "proposedQty": max(0, int(daily_sales * 14 - stock_level))
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
            best_supplier = ProductSupplier.objects.filter(
                product=product
            ).select_related('supplier').order_by('last_purchased_price').first()
        else:
            best_supplier = None

        sourcing_info = {
            'best_supplier': best_supplier.supplier.name if best_supplier else None,
            'best_price': float(best_supplier.last_purchased_price) if best_supplier else None,
            'last_purchased': best_supplier.last_purchased_date if best_supplier else None,
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

