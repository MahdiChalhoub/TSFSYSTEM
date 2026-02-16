"""
Inventory Module Views
ViewSets for product catalog, stock management, warehouse operations, and product taxonomy.

Audit Fixes Applied (v1.3.2-b022):
- C3: storefront uses throttle + limited fields
- H1: viewer uses annotations instead of N+1
- H2: BrandViewSet.hierarchy prefetches all products once
- H3: CategoryViewSet.with_counts uses annotate
- H4: receive_stock/adjust_stock validate product/warehouse ownership
- H5: bulk_move validates target entity existence + ownership
- M1: daily_sales calculated from InventoryMovement
- M3: viewer supports limit/offset pagination
- L1: removed no-op get_queryset override
- L3: added select_related to ProductViewSet
- L5: viewer supports categoryId/brandId filters
- L6: added read-only InventoryMovementViewSet
"""
from datetime import timedelta

from django.db import transaction
from django.db.models import Q, Sum, Count, Subquery, OuterRef, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import AnonRateThrottle

from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from erp.models import Organization, Site
from erp.serializers import SiteSerializer

from apps.inventory.models import (
    Product, Unit, Warehouse, Inventory, InventoryMovement,
    Brand, Category, Parfum, ProductGroup,
    StockAdjustmentOrder, StockAdjustmentLine,
    StockTransferOrder, StockTransferLine,
    OperationalRequest, OperationalRequestLine,
)
from apps.inventory.serializers import (
    ProductSerializer, ProductCreateSerializer, UnitSerializer,
    WarehouseSerializer, InventorySerializer, InventoryMovementSerializer,
    BrandSerializer, BrandDetailSerializer, CategorySerializer,
    ParfumSerializer, ProductGroupSerializer,
    StockAdjustmentOrderSerializer, StockAdjustmentLineSerializer,
    StockTransferOrderSerializer, StockTransferLineSerializer,
    OperationalRequestSerializer, OperationalRequestLineSerializer,
    ProductAnalyticsSerializer,
)
from apps.inventory.services import InventoryService
from erp.lifecycle_mixin import LifecycleViewSetMixin


# =============================================================================
# HELPER: Resolve tenant or return 400
# =============================================================================
def _get_org_or_400():
    """Returns (organization, None) or (None, Response)."""
    organization_id = get_current_tenant_id()
    if not organization_id:
        return None, Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        org = Organization.objects.get(id=organization_id)
        return org, None
    except Organization.DoesNotExist:
        return None, Response({"error": "Organization not found"}, status=status.HTTP_404_NOT_FOUND)


# =============================================================================
# UNIT
# =============================================================================

class UnitViewSet(TenantModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer


# =============================================================================
# PRODUCT
# =============================================================================

class ProductViewSet(TenantModelViewSet):
    queryset = Product.objects.select_related(
        'brand', 'country', 'category', 'unit', 'parfum', 'size_unit', 'product_group'
    ).all()
    serializer_class = ProductSerializer

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
        slug = request.query_params.get('organization_slug')
        if not slug:
            return Response({"error": "Organization slug required"}, status=400)

        try:
            org = Organization.objects.get(slug=slug)
            products = Product.objects.filter(
                organization=org, status='ACTIVE'
            ).select_related('brand', 'category', 'unit')[:100]  # pagination cap

            data = [{
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "category": p.category.name if p.category else None,
                "brand": p.brand.name if p.brand else None,
                "unit": p.unit.code if p.unit else None,
                "selling_price_ttc": float(p.selling_price_ttc),
                "is_active": p.is_active,
            } for p in products]
            return Response(data)
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

            if updates:
                count = products.update(**updates)

            return Response({"success": True, "count": count})

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

    # --- M1: daily_sales from InventoryMovement ---
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

        products_qs = products_qs[:10]

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
                "stockLevel": float(stock_level),
                "dailySales": round(daily_sales, 2),
                "proposedQty": max(0, int(daily_sales * 14 - float(stock_level)))
            })

        return Response(data)

    # ─── Product Analytics (analytical product list) ─────────────────
    @action(detail=False, methods=['get'])
    def product_analytics(self, request):
        """
        Returns products enriched with stock, sales metrics, health score,
        and operational request lifecycle status. Uses batch queries.
        """
        organization, err = _get_org_or_400()
        if err:
            return err

        # ── Query params ──
        search = request.query_params.get('search', '')
        category_id = request.query_params.get('category')
        brand_id = request.query_params.get('brand')
        warehouse_id = request.query_params.get('warehouse_id')
        status_filter = request.query_params.get('status')  # AVAILABLE, REQUESTED, ORDER_CREATED, FAILED
        hide_completed = request.query_params.get('hide_completed', 'false').lower() == 'true'
        limit = min(int(request.query_params.get('limit', 50)), 200)
        offset = int(request.query_params.get('offset', 0))

        # ── Base queryset ──
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

        # ── Batch: Stock ──
        stock_filter = {'organization': organization, 'product_id__in': product_ids}
        if warehouse_id:
            stock_filter['warehouse_id'] = warehouse_id

        stock_rows = Inventory.objects.filter(**stock_filter).values(
            'product_id'
        ).annotate(total_qty=Coalesce(Sum('quantity'), 0, output_field=DecimalField()))
        stock_map = {r['product_id']: float(r['total_qty']) for r in stock_rows}

        # ── Batch: Sales (OUT movements, last 30 days) ──
        sales_rows = InventoryMovement.objects.filter(
            organization=organization, product_id__in=product_ids,
            type='OUT', created_at__gte=thirty_days_ago
        ).values('product_id').annotate(total_out=Coalesce(Sum('quantity'), 0, output_field=DecimalField()))
        sales_map = {r['product_id']: float(r['total_out']) for r in sales_rows}

        # ── Batch: Purchases (IN movements, last 30 days) ──
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

        # ── Batch: Latest operational request per product ──
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
                    'id': req.id,
                    'priority': req.priority,
                    'converted_to_type': req.converted_to_type,
                    'converted_to_id': req.converted_to_id,
                    'rejection_reason': req.rejection_reason,
                }

        # ── Build response ──
        results = []
        for p in product_list:
            total_stock = stock_map.get(p.id, 0)
            total_sold = sales_map.get(p.id, 0)
            purch = purchase_map.get(p.id, {'total_in': 0, 'total_cost': 0, 'count': 0})

            avg_daily = round(total_sold / 30.0, 2)
            avg_monthly = round(total_sold, 2)
            avg_unit_cost = round(purch['total_cost'] / purch['total_in'], 2) if purch['total_in'] > 0 else float(p.cost_price)
            stock_days = round(total_stock / avg_daily, 1) if avg_daily > 0 else None

            # Health score (0-100)
            if avg_daily <= 0:
                health = 50
            elif stock_days is not None:
                if stock_days >= 30:
                    health = 95
                elif stock_days >= 14:
                    health = 80
                elif stock_days >= 7:
                    health = 60
                elif stock_days >= 3:
                    health = 40
                else:
                    health = 20
            else:
                health = 50

            if total_stock <= 0:
                health = max(health - 30, 0)
            elif total_stock < p.min_stock_level:
                health = max(health - 15, 0)

            # Request lifecycle
            req_info = request_map.get(p.id)
            request_status_val = None
            request_type_val = None
            request_id_val = None
            request_priority_val = None
            order_type_val = None
            order_id_val = None
            rejection_reason_val = None

            if req_info:
                request_status_val = req_info['status']
                request_type_val = req_info['type']
                request_id_val = req_info['id']
                request_priority_val = req_info['priority']
                order_type_val = req_info['converted_to_type']
                order_id_val = req_info['converted_to_id']
                rejection_reason_val = req_info['rejection_reason']

            # Apply status filter
            if status_filter:
                if status_filter == 'AVAILABLE' and request_status_val is not None:
                    continue
                if status_filter == 'REQUESTED' and request_status_val not in ('PENDING', 'APPROVED'):
                    continue
                if status_filter == 'ORDER_CREATED' and request_status_val != 'CONVERTED':
                    continue
                if status_filter == 'FAILED' and request_status_val != 'REJECTED':
                    continue

            if hide_completed and request_status_val == 'CONVERTED':
                continue

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
                'health_score': health,
                'stock_days_remaining': stock_days,
                'request_status': request_status_val,
                'request_type': request_type_val,
                'request_id': request_id_val,
                'request_priority': request_priority_val,
                'order_type': order_type_val,
                'order_id': order_id_val,
                'rejection_reason': rejection_reason_val,
            })

        return Response({'products': results, 'total': total_count})


# =============================================================================
# WAREHOUSE
# =============================================================================

class WarehouseViewSet(TenantModelViewSet):
    queryset = Warehouse.objects.select_related('site').all()
    serializer_class = WarehouseSerializer


# =============================================================================
# INVENTORY  (L1: removed no-op get_queryset override)
# =============================================================================

class InventoryViewSet(TenantModelViewSet):
    queryset = Inventory.objects.select_related('product', 'warehouse').all()
    serializer_class = InventorySerializer

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

    @action(detail=False, methods=['get'])
    def financial_status(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        status_data = InventoryService.get_inventory_financial_status(organization)
        return Response(status_data)

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

    # --- H1 + M3 + L5: viewer with annotations, pagination, filters ---
    @action(detail=False, methods=['get'])
    def viewer(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        search = request.query_params.get('search', '')
        category_id = request.query_params.get('categoryId')
        brand_id = request.query_params.get('brandId')
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

        # Paginate
        products_qs = products_qs[offset:offset + limit]

        sites = Site.objects.filter(organization=organization, is_active=True)

        # Build site stock data using batch queries instead of N+1
        product_ids = [p.id for p in products_qs]

        # One query: get all inventory rows for these products
        stock_rows = Inventory.objects.filter(
            organization=organization,
            product_id__in=product_ids,
        ).select_related('warehouse').values(
            'product_id', 'warehouse__site_id'
        ).annotate(total_qty=Sum('quantity'))

        # Build lookup: {product_id: {site_id: qty}}
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

            # Ensure all sites have an entry (even if 0)
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


# =============================================================================
# BRAND
# =============================================================================

class BrandViewSet(TenantModelViewSet):
    queryset = Brand.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BrandDetailSerializer
        return BrandSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        category_id = request.query_params.get('category_id')

        brands = Brand.objects.filter(organization=organization)
        if category_id:
            product_brand_ids = Product.objects.filter(
                organization=organization,
                category_id=category_id
            ).values_list('brand_id', flat=True).distinct()
            brands = brands.filter(id__in=product_brand_ids)

        serializer = BrandSerializer(brands, many=True)
        return Response(serializer.data)

    # --- H2: hierarchy with prefetch instead of N+1 ---
    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            brand = Brand.objects.get(id=pk, organization=organization)
        except Brand.DoesNotExist:
            return Response({"error": "Brand not found"}, status=404)

        # Prefetch ALL products for this brand in one query
        all_products = list(Product.objects.filter(
            organization=organization, brand=brand
        ).select_related('category', 'unit', 'parfum', 'country', 'size_unit', 'product_group'))

        # Group by parfum
        parfum_groups = {}
        ungrouped = []
        for p in all_products:
            if p.parfum_id:
                parfum_groups.setdefault(p.parfum_id, []).append(p)
            else:
                ungrouped.append(p)

        # Fetch parfum objects for the grouped IDs
        parfum_objs = {pf.id: pf for pf in Parfum.objects.filter(id__in=parfum_groups.keys())}

        brand_data = BrandDetailSerializer(brand).data

        hierarchy = {
            "brand": brand_data,
            "countries": list(brand.countries.values('id', 'code', 'name')),
            "productGroups": [],
            "products": [],
            "parfums": []
        }

        for parfum_id, products in parfum_groups.items():
            hierarchy["parfums"].append({
                "parfum": ParfumSerializer(parfum_objs[parfum_id]).data,
                "products": ProductSerializer(products, many=True).data
            })

        if ungrouped:
            hierarchy["parfums"].append({
                "parfum": {"id": None, "name": "Ungrouped"},
                "products": ProductSerializer(ungrouped, many=True).data
            })

        # Group by product_group
        group_map = {}
        standalone = []
        for p in all_products:
            if p.product_group_id:
                group_map.setdefault(p.product_group_id, []).append(p)
            else:
                standalone.append(p)

        pg_objs = {pg.id: pg for pg in ProductGroup.objects.filter(id__in=group_map.keys())}
        for gid, products in group_map.items():
            hierarchy["productGroups"].append({
                "id": gid,
                "name": pg_objs[gid].name,
                "products": ProductSerializer(products, many=True).data
            })

        hierarchy["products"] = ProductSerializer(standalone, many=True).data

        return Response(hierarchy)


# =============================================================================
# CATEGORY
# =============================================================================

class CategoryViewSet(TenantModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    # --- H3: with_counts using annotate ---
    @action(detail=False, methods=['get'])
    def with_counts(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        categories = Category.objects.filter(
            organization=organization
        ).annotate(
            product_count=Count('product')
        )

        data = []
        for cat in categories:
            cat_data = CategorySerializer(cat).data
            cat_data["productCount"] = cat.product_count
            data.append(cat_data)

        return Response(data)

    @action(detail=False, methods=['post'])
    def move_products(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        product_ids = request.data.get('product_ids', [])
        target_category_id = request.data.get('target_category_id')

        if not product_ids or not target_category_id:
            return Response({"error": "Missing parameters"}, status=400)

        # Validate target exists in this organization
        if not Category.objects.filter(id=target_category_id, organization=organization).exists():
            return Response({"error": "Target category not found"}, status=404)

        Product.objects.filter(id__in=product_ids, organization=organization).update(category_id=target_category_id)
        return Response({"success": True})


# =============================================================================
# PARFUM (ATTRIBUTE)
# =============================================================================

class ParfumViewSet(TenantModelViewSet):
    queryset = Parfum.objects.all()
    serializer_class = ParfumSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        category_id = request.query_params.get('category_id')
        brand_id = request.query_params.get('brand_id')

        parfums = Parfum.objects.filter(organization=organization)
        if category_id or brand_id:
            product_filter = {'organization': organization}
            if category_id:
                product_filter['category_id'] = category_id
            if brand_id:
                product_filter['brand_id'] = brand_id

            parfum_ids = Product.objects.filter(**product_filter).values_list('parfum_id', flat=True).distinct()
            parfums = parfums.filter(id__in=parfum_ids)

        serializer = ParfumSerializer(parfums, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            parfum = Parfum.objects.get(id=pk, organization=organization)
        except Parfum.DoesNotExist:
            return Response({"error": "Parfum not found"}, status=404)

        # Prefetch all products for this parfum at once
        all_products = list(Product.objects.filter(
            organization=organization, parfum=parfum
        ).select_related('brand', 'category', 'unit', 'country', 'size_unit'))

        # Group by brand
        brand_groups = {}
        for p in all_products:
            if p.brand_id:
                brand_groups.setdefault(p.brand_id, []).append(p)

        brand_objs = {b.id: b for b in Brand.objects.filter(id__in=brand_groups.keys())}

        hierarchy = {
            "parfum": ParfumSerializer(parfum).data,
            "brands": []
        }

        for brand_id, products in brand_groups.items():
            hierarchy["brands"].append({
                "brand": BrandSerializer(brand_objs[brand_id]).data,
                "products": ProductSerializer(products, many=True).data
            })

        return Response(hierarchy)


# =============================================================================
# PRODUCT GROUP
# =============================================================================

class ProductGroupViewSet(TenantModelViewSet):
    queryset = ProductGroup.objects.select_related('brand', 'parfum', 'category').all()
    serializer_class = ProductGroupSerializer

    @action(detail=False, methods=['post'])
    def create_with_variants(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            with transaction.atomic():
                group = ProductGroup.objects.create(
                    organization=organization,
                    name=request.data.get('name'),
                    description=request.data.get('description', ''),
                    brand_id=request.data.get('brand_id'),
                    category_id=request.data.get('category_id'),
                    parfum_id=request.data.get('parfum_id')
                )

                variants = request.data.get('variants', [])
                for v in variants:
                    Product.objects.create(
                        organization=organization,
                        name=v.get('name'),
                        sku=v.get('sku'),
                        barcode=v.get('barcode'),
                        selling_price_ht=v.get('sellingPriceHT', 0),
                        selling_price_ttc=v.get('sellingPriceTTC', 0),
                        cost_price=v.get('costPrice', 0),
                        cost_price_ht=v.get('costPrice', 0),
                        tva_rate=v.get('taxRate', 0),
                        product_group=group,
                        brand_id=request.data.get('brand_id'),
                        category_id=request.data.get('category_id'),
                        parfum_id=request.data.get('parfum_id'),
                        unit_id=v.get('unit_id'),
                        status='ACTIVE'
                    )

                return Response(ProductGroupSerializer(group).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['put'])
    def update_with_variants(self, request, pk=None):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            group = ProductGroup.objects.get(id=pk, organization=organization)

            with transaction.atomic():
                group.name = request.data.get('name', group.name)
                group.description = request.data.get('description', group.description)
                group.brand_id = request.data.get('brand_id', group.brand_id)
                group.category_id = request.data.get('category_id', group.category_id)
                group.parfum_id = request.data.get('parfum_id', group.parfum_id)
                group.save()

                variants = request.data.get('variants', [])
                existing_ids = set()

                for v in variants:
                    vid = v.get('id')
                    if vid:
                        product = Product.objects.get(id=vid, organization=organization)
                        product.name = v.get('name', product.name)
                        product.sku = v.get('sku', product.sku)
                        product.barcode = v.get('barcode', product.barcode)
                        product.selling_price_ht = v.get('sellingPriceHT', product.selling_price_ht)
                        product.selling_price_ttc = v.get('sellingPriceTTC', product.selling_price_ttc)
                        product.cost_price = v.get('costPrice', product.cost_price)
                        product.tva_rate = v.get('taxRate', product.tva_rate)
                        product.save()
                        existing_ids.add(vid)
                    else:
                        new_product = Product.objects.create(
                            organization=organization,
                            name=v.get('name'),
                            sku=v.get('sku'),
                            barcode=v.get('barcode'),
                            selling_price_ht=v.get('sellingPriceHT', 0),
                            selling_price_ttc=v.get('sellingPriceTTC', 0),
                            cost_price=v.get('costPrice', 0),
                            cost_price_ht=v.get('costPrice', 0),
                            tva_rate=v.get('taxRate', 0),
                            product_group=group,
                            brand_id=group.brand_id,
                            category_id=group.category_id,
                            parfum_id=group.parfum_id,
                            status='ACTIVE'
                        )
                        existing_ids.add(new_product.id)

                if request.data.get('removeOrphans'):
                    Product.objects.filter(
                        product_group=group, organization=organization
                    ).exclude(id__in=existing_ids).update(product_group=None)

                return Response(ProductGroupSerializer(group).data)
        except ProductGroup.DoesNotExist:
            return Response({"error": "Product Group not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def link_products(self, request, pk=None):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            group = ProductGroup.objects.get(id=pk, organization=organization)
            product_ids = request.data.get('product_ids', [])

            Product.objects.filter(id__in=product_ids, organization=organization).update(product_group=group)

            return Response({"success": True, "count": len(product_ids)})
        except ProductGroup.DoesNotExist:
            return Response({"error": "Product Group not found"}, status=404)

    @action(detail=False, methods=['post'])
    def create_from_products(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            product_ids = request.data.get('product_ids', [])
            group_name = request.data.get('name', 'Auto Group')

            products = Product.objects.filter(id__in=product_ids, organization=organization)
            if not products.exists():
                return Response({"error": "No valid products found"}, status=400)

            first = products.first()
            group = ProductGroup.objects.create(
                organization=organization,
                name=group_name,
                brand_id=first.brand_id,
                category_id=first.category_id,
                parfum_id=first.parfum_id
            )

            products.update(product_group=group)

            return Response(ProductGroupSerializer(group).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# L6: INVENTORY MOVEMENT (read-only audit trail)
# =============================================================================

class InventoryMovementViewSet(TenantModelViewSet):
    queryset = InventoryMovement.objects.select_related('product', 'warehouse').all()
    serializer_class = InventoryMovementSerializer
    http_method_names = ['get', 'head', 'options']  # Read-only

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


# =============================================================================
# STOCK ADJUSTMENT ORDERS
# =============================================================================

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
        """Execute all adjustments once order is CONFIRMED."""
        order = self.get_object()
        if order.lifecycle_status != 'CONFIRMED':
            return Response({'error': 'Order must be CONFIRMED before posting'}, status=400)
        if order.is_posted:
            return Response({'error': 'Order already posted'}, status=400)
        organization = order.organization
        try:
            with transaction.atomic():
                for line in order.lines.select_related('product', 'warehouse').all():
                    InventoryService.adjust_stock(
                        organization=organization,
                        product=line.product,
                        warehouse=line.warehouse,
                        quantity=line.qty_adjustment,
                        reason=line.reason or order.reason or 'Stock Adjustment',
                        reference=order.reference,
                    )
                order.is_posted = True
                order.save(update_fields=['is_posted'])
            return Response({'message': f'Posted {order.lines.count()} adjustments'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    def _update_totals(self, order):
        from django.db.models import Sum
        agg = order.lines.aggregate(
            total_qty=Sum('qty_adjustment'),
            total_amt=Sum('amount_adjustment')
        )
        order.total_qty_adjustment = agg['total_qty'] or 0
        order.total_amount_adjustment = agg['total_amt'] or 0
        order.save(update_fields=['total_qty_adjustment', 'total_amount_adjustment'])


# =============================================================================
# STOCK TRANSFER ORDERS
# =============================================================================

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
        """Execute all transfers once order is CONFIRMED."""
        order = self.get_object()
        if order.lifecycle_status != 'CONFIRMED':
            return Response({'error': 'Order must be CONFIRMED before posting'}, status=400)
        if order.is_posted:
            return Response({'error': 'Order already posted'}, status=400)
        organization = order.organization
        try:
            with transaction.atomic():
                for line in order.lines.select_related('product', 'from_warehouse', 'to_warehouse').all():
                    InventoryService.transfer_stock(
                        organization=organization,
                        product=line.product,
                        source_warehouse=line.from_warehouse,
                        destination_warehouse=line.to_warehouse,
                        quantity=line.qty_transferred,
                        reference=order.reference,
                    )
                order.is_posted = True
                order.save(update_fields=['is_posted'])
            return Response({'message': f'Posted {order.lines.count()} transfers'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    def _update_totals(self, order):
        from django.db.models import Sum
        agg = order.lines.aggregate(total_qty=Sum('qty_transferred'))
        order.total_qty_transferred = agg['total_qty'] or 0
        order.save(update_fields=['total_qty_transferred'])


# =============================================================================
# OPERATIONAL REQUESTS
# =============================================================================

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
        """Convert approved request into a stock order."""
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
