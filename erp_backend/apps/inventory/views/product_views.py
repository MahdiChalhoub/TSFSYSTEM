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

class ProductViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = Product.objects.select_related(
        'brand', 'country', 'category', 'unit', 'parfum', 'size_unit', 'product_group'
    ).all()
    serializer_class = ProductSerializer
    filterset_fields = ['category', 'brand', 'product_type', 'is_active', 'tracks_serials']
    search_fields = ['name', 'sku', 'barcode', 'description']
    ordering_fields = ['name', 'sku', 'selling_price_ttc', 'cost_price', 'stock_level', 'created_at']

    # --- C3: Throttled public storefront ---
    class StorefrontThrottle(AnonRateThrottle):
        rate = '30/minute'

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny],
            throttle_classes=[StorefrontThrottle])
    def storefront(self, request):
        """
        Public endpoint for tenant storefronts.
        Throttled, paginated, and returns limited fields.
        """
        slug = request.query_params.get('organization_slug') or request.query_params.get('organizationSlug')
        if not slug:
            return Response({"error": "Organization slug required"}, status=400)

        try:
            org = Organization.objects.get(slug=slug)
            products = Product.objects.filter(
                organization=org, status='ACTIVE'
            ).select_related('brand', 'category', 'unit').prefetch_related(
                'variants__attribute_values__attribute'
            )[:100]

            serializer = StorefrontProductSerializer(products, many=True)
            return Response(serializer.data)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=404)

    # --- H5: bulk_move with target validation ---
    @action(detail=False, methods=['post'])
    def bulk_move(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        product_ids = request.data.get('productIds', [])
        target_id = request.data.get('targetId')
        move_type = request.data.get('type')

        if not product_ids or not target_id or not move_type:
            return Response({"error": "Missing parameters"}, status=400)

        # Validate target entity exists and belongs to this organization
        target_model_map = {
            'category': Category,
            'brand': Brand,
            'unit': Unit,
            'country': None,  # Country is a shared model, no org filter
            'attribute': Parfum,
        }

        target_model = target_model_map.get(move_type)
        if target_model is None and move_type == 'country':
            from erp.models import Country
            if not Country.objects.filter(id=target_id).exists():
                return Response({"error": f"Country with id {target_id} not found"}, status=404)
        elif target_model:
            if not target_model.objects.filter(id=target_id, organization=organization).exists():
                return Response({"error": f"{move_type.title()} with id {target_id} not found"}, status=404)
        else:
            return Response({"error": f"Unknown move type: {move_type}"}, status=400)

        with transaction.atomic():
            products = Product.objects.filter(id__in=product_ids, organization=organization)

            updates = {}
            if move_type == 'category':
                updates['category_id'] = target_id
                updates['product_group_id'] = None
            elif move_type == 'brand':
                updates['brand_id'] = target_id
                updates['product_group_id'] = None
            elif move_type == 'unit':
                updates['unit_id'] = target_id
            elif move_type == 'country':
                updates['country_id'] = target_id
            elif move_type == 'attribute':
                updates['parfum_id'] = target_id

            count = 0
            if updates:
                count = products.update(**updates)

            return Response({"success": True, "count": count})

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        Bulk update product fields. Accepts a list of updates:
        [{ "id": 123, "name": "New Name", "tva_rate": "19.00", ... }, ...]
        Allowed fields: name, barcode, category, brand, unit, parfum, tva_rate,
        cost_price_ht, cost_price_ttc, selling_price_ht, selling_price_ttc, size
        """
        organization, err = _get_org_or_400()
        if err: return err

        updates = request.data.get('updates', [])
        if not updates:
            return Response({"error": "No updates provided"}, status=400)

        ALLOWED_FIELDS = {
            'name', 'barcode', 'tva_rate', 'cost_price_ht', 'cost_price_ttc',
            'selling_price_ht', 'selling_price_ttc', 'size', 'description',
            'min_stock_level', 'is_expiry_tracked',
        }
        FK_FIELDS = {
            'category': ('category_id', Category),
            'brand': ('brand_id', Brand),
            'unit': ('unit_id', Unit),
            'parfum': ('parfum_id', Parfum),
        }

        updated = 0
        errors = []
        with transaction.atomic():
            for item in updates:
                product_id = item.get('id')
                if not product_id:
                    continue
                try:
                    product = Product.objects.get(id=product_id, organization=organization)
                except Product.DoesNotExist:
                    errors.append(f"Product {product_id} not found")
                    continue

                for field, value in item.items():
                    if field == 'id':
                        continue
                    if field in ALLOWED_FIELDS:
                        setattr(product, field, value)
                    elif field in FK_FIELDS:
                        db_field, model_class = FK_FIELDS[field]
                        if value is None:
                            setattr(product, db_field, None)
                        else:
                            setattr(product, db_field, value)

                product.save()
                updated += 1

        return Response({"success": True, "updated": updated, "errors": errors})

    @action(detail=False, methods=['post'])
    def generate_barcodes(self, request):
        """
        Generate EAN-13 barcodes for products that don't have one.
        Accepts: { "product_ids": [1, 2, 3] } or { "all_missing": true }
        """
        organization, err = _get_org_or_400()
        if err: return err

        product_ids = request.data.get('product_ids', [])
        all_missing = request.data.get('all_missing', False)

        if all_missing:
            products = Product.objects.filter(
                organization=organization,
                is_active=True,
            ).filter(
                Q(barcode__isnull=True) | Q(barcode='')
            )
        elif product_ids:
            products = Product.objects.filter(
                id__in=product_ids, organization=organization
            ).filter(
                Q(barcode__isnull=True) | Q(barcode='')
            )
        else:
            return Response({"error": "Provide product_ids or set all_missing=true"}, status=400)

        try:
            from apps.finance.services import BarcodeService
        except ImportError:
            return Response({"error": "Barcode service not available"}, status=500)

        generated = 0
        with transaction.atomic():
            for product in products:
                barcode = BarcodeService.generate_barcode(organization)
                product.barcode = barcode
                product.save(update_fields=['barcode'])
                generated += 1

        return Response({"success": True, "generated": generated})

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

    @action(detail=False, methods=['post'])
    def create_complex(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        serializer = ProductCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        if Product.objects.filter(organization=organization, sku=data['sku']).exists():
             return Response({"error": "SKU already exists"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            parfum_id = None
            product_group_id = None

            parfum_name = data.get('parfumName')
            brand_id = data.get('brandId')
            category_id = data.get('categoryId')

            if parfum_name and brand_id:
                parfum, created = Parfum.objects.update_or_create(
                    organization=organization,
                    name=parfum_name,
                    defaults={}
                )
                parfum_id = parfum.id

                group = ProductGroup.objects.filter(
                    organization=organization,
                    brand_id=brand_id,
                    parfum_id=parfum_id
                ).first()

                if not group:
                    brand = Brand.objects.get(id=brand_id, organization=organization)
                    group_name = f"{brand.name} {parfum_name}".strip()
                    group = ProductGroup.objects.create(
                        organization=organization,
                        name=group_name,
                        brand_id=brand_id,
                        parfum_id=parfum_id,
                        category_id=category_id,
                        description=f"Auto-generated group via {parfum_name}"
                    )
                product_group_id = group.id

            product = Product.objects.create(
                organization=organization,
                name=data['name'],
                description=data.get('description', ''),
                sku=data['sku'],
                barcode=data.get('barcode'),
                category_id=category_id,
                unit_id=data.get('unitId'),
                brand_id=brand_id,
                country_id=data.get('countryId'),
                parfum_id=parfum_id,
                product_group_id=product_group_id,

                cost_price=data.get('costPrice', 0),
                cost_price_ht=data.get('costPrice', 0),
                status='ACTIVE',
                selling_price_ht=data.get('sellingPriceHT', 0),
                selling_price_ttc=data.get('sellingPriceTTC', 0),
                tva_rate=data.get('taxRate', 0),

                min_stock_level=data.get('minStockLevel', 10),
                is_expiry_tracked=data.get('isExpiryTracked', False),
                size=data.get('size'),
                size_unit_id=data.get('sizeUnitId'),
            )

            return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search_enhanced(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')

        products_qs = Product.objects.filter(
            organization=organization, status='ACTIVE'
        ).select_related('brand', 'category', 'unit')
        if query:
            products_qs = products_qs.filter(
                Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)
            )

        products_qs = products_qs[:100]
        thirty_days_ago = timezone.now() - timedelta(days=30)

        data = []
        for p in products_qs:
            stock_filter = {'organization': organization, 'product': p}
            if site_id:
                stock_filter['warehouse__site_id'] = site_id

            stock_level = Inventory.objects.filter(**stock_filter).aggregate(
                total=Sum('quantity')
            )['total'] or 0

            # M1: Calculate actual daily sales from OUT movements
            total_out = InventoryMovement.objects.filter(
                organization=organization,
                product=p,
                type='OUT',
                created_at__gte=thirty_days_ago,
            ).aggregate(total=Sum('quantity'))['total'] or 0
            daily_sales = float(total_out) / 30.0

            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "costPrice": float(p.cost_price),
                "costPriceHT": float(p.cost_price_ht),
                "sellingPriceHT": float(p.selling_price_ht),
                "sellingPriceTTC": float(p.selling_price_ttc),
                "basePrice": float(p.selling_price_ttc),
                "price": float(p.selling_price_ttc),
                "taxRate": float(getattr(p, 'tva_rate', 0) or 0),
                "isTaxIncluded": True,
                "stockLevel": float(stock_level),
                "dailySales": round(daily_sales, 2),
                "proposedQty": max(0, int(daily_sales * 14 - float(stock_level)))
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
            request__organization=organization
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

        from apps.pos.sourcing_models import ProductSupplier
        best_supplier = ProductSupplier.objects.filter(
            product=product
        ).select_related('supplier').order_by('last_purchased_price').first()

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

    @action(detail=True, methods=['get'], url_path='combo-components')
    def combo_components(self, request, pk=None):
        """List all components of a combo/bundle product."""
        product = self.get_object()
        components = ComboComponent.objects.filter(
            combo_product=product
        ).select_related('component_product').order_by('sort_order')
        serializer = ComboComponentSerializer(components, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-component')
    def add_combo_component(self, request, pk=None):
        """Add a component to a combo/bundle product."""
        product = self.get_object()
        if product.product_type != 'COMBO':
            return Response({'error': 'Product is not a combo/bundle'}, status=400)

        component_id = request.data.get('component_product_id')
        quantity = request.data.get('quantity', 1)
        price_override = request.data.get('price_override')
        sort_order = request.data.get('sort_order', 0)

        if not component_id:
            return Response({'error': 'component_product_id is required'}, status=400)
        if str(component_id) == str(product.id):
            return Response({'error': 'Cannot add product as its own component'}, status=400)

        try:
            component_product = Product.objects.get(
                id=component_id, organization=product.organization
            )
        except Product.DoesNotExist:
            return Response({'error': 'Component product not found'}, status=404)

        comp, created = ComboComponent.objects.update_or_create(
            combo_product=product,
            component_product=component_product,
            organization=product.organization,
            defaults={
                'quantity': quantity,
                'price_override': price_override,
                'sort_order': sort_order,
            }
        )
        return Response(
            ComboComponentSerializer(comp).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=True, methods=['delete'], url_path='remove-component/(?P<component_id>[^/.]+)')
    def remove_combo_component(self, request, pk=None, component_id=None):
        """Remove a component from a combo/bundle product."""
        product = self.get_object()
        deleted, _ = ComboComponent.objects.filter(
            combo_product=product, id=component_id
        ).delete()
        if deleted:
            return Response({'success': True})
        return Response({'error': 'Component not found'}, status=404)
