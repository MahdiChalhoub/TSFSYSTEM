"""
Stock Cross-Analysis Matrix API
================================
Provides multi-dimensional stock analysis across products, countries,
parfums (variants), sizes, warehouses, and branches.

Groups similar products (same ProductGroup or Brand+Category) and presents
a matrix of stock by country_of_origin × parfum × size.

View 1: By Country  → Country > Product > Parfum > Stock
View 2: By Product  → ProductGroup > Parfum > Country × Size > Stock
"""
import logging
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import (
    Sum, Count, F, Value, CharField, DecimalField,
    Q, Case, When, Subquery, OuterRef
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views import TenantModelViewSet
from apps.inventory.models.product_models import Product, ProductGroup, Brand, Parfum
from apps.inventory.models.warehouse_models import Warehouse
from apps.inventory.mixins.branch_scoped import BranchScopedMixin

logger = logging.getLogger(__name__)


class StockMatrixViewSet(BranchScopedMixin, TenantModelViewSet):
    """
    Stock Cross-Analysis Matrix.

    GET /api/inventory/stock-matrix/by-country/
    GET /api/inventory/stock-matrix/by-product/
    GET /api/inventory/stock-matrix/filters/
    GET /api/inventory/stock-matrix/sales-periods/
    """
    queryset = Product.objects.none()
    http_method_names = ['get']

    def get_queryset(self):
        return Product.objects.filter(
            organization=self.request.organization
        ).select_related(
            'brand', 'parfum', 'product_group', 'category',
            'unit', 'size_unit', 'country_of_origin'
        )

    def _get_stock_subquery(self, group_by_field, warehouse_filter=None, country_filter=None):
        """Build stock aggregation from StockLedger."""
        from apps.inventory.models.stock_ledger_model import StockLedger

        qs = StockLedger.objects.filter(
            organization=self.request.organization,
            product=OuterRef('pk'),
        )

        if warehouse_filter:
            qs = qs.filter(warehouse_id__in=warehouse_filter)
        if country_filter:
            qs = qs.filter(warehouse__country_id__in=country_filter)

        return qs

    def _get_product_stock(self, product_ids, warehouse_ids=None, country_ids=None, branch_ids=None):
        """
        Get latest stock for a set of products.
        Returns dict: product_id -> { on_hand, reserved, available, warehouses: {...} }
        """
        from apps.inventory.models.stock_ledger_model import StockLedger

        # Get latest ledger entry per product+warehouse combo
        ledger_qs = StockLedger.objects.filter(
            organization=self.request.organization,
            product_id__in=product_ids,
        ).order_by('product_id', 'warehouse_id', '-created_at')

        if warehouse_ids:
            ledger_qs = ledger_qs.filter(warehouse_id__in=warehouse_ids)
        if branch_ids:
            ledger_qs = ledger_qs.filter(warehouse__parent_id__in=branch_ids)
        if country_ids:
            ledger_qs = ledger_qs.filter(warehouse__country_id__in=country_ids)

        # Get latest entry per product+warehouse
        seen = set()
        stock_data = defaultdict(lambda: {
            'on_hand': Decimal('0'),
            'reserved': Decimal('0'),
            'available': Decimal('0'),
            'warehouse_breakdown': defaultdict(lambda: {
                'on_hand': Decimal('0'),
                'reserved': Decimal('0'),
                'warehouse_name': '',
                'country_id': None,
                'country_name': '',
            })
        })

        for entry in ledger_qs.select_related('warehouse', 'warehouse__country').iterator():
            key = (entry.product_id, entry.warehouse_id)
            if key in seen:
                continue
            seen.add(key)

            pd = stock_data[entry.product_id]
            pd['on_hand'] += entry.running_on_hand
            pd['reserved'] += entry.running_reserved
            pd['available'] += (entry.running_on_hand - entry.running_reserved)

            wh = pd['warehouse_breakdown'][entry.warehouse_id]
            wh['on_hand'] = entry.running_on_hand
            wh['reserved'] = entry.running_reserved
            wh['warehouse_name'] = entry.warehouse.name if entry.warehouse else ''
            wh['country_id'] = entry.warehouse.country_id if entry.warehouse else None
            wh['country_name'] = (
                entry.warehouse.country.name
                if entry.warehouse and entry.warehouse.country
                else ''
            )

        return dict(stock_data)

    def _get_product_trends(self, product_ids):
        """
        Calculate sales trend for products by comparing last 30 days vs previous 30 days.
        Returns dict: product_id -> 'UP' | 'DOWN' | 'STABLE'
        """
        from apps.pos.models.pos_models import OrderLine, Order

        now = timezone.now()
        last_30 = now - timedelta(days=30)
        prev_30 = now - timedelta(days=60)
        org = self.request.organization

        # Sales in last 30 days
        recent = OrderLine.objects.filter(
            order__organization=org,
            order__type='SALE',
            order__order_status__in=['CONFIRMED', 'PROCESSING', 'CLOSED'],
            order__created_at__gte=last_30,
        ).values('product_id').annotate(
            total=Coalesce(Sum('quantity'), Decimal('0'), output_field=DecimalField())
        )
        recent_map = {r['product_id']: float(r['total']) for r in recent if r['product_id'] in product_ids}

        # Sales in previous 30 days (day 31-60)
        prev = OrderLine.objects.filter(
            order__organization=org,
            order__type='SALE',
            order__order_status__in=['CONFIRMED', 'PROCESSING', 'CLOSED'],
            order__created_at__gte=prev_30,
            order__created_at__lt=last_30,
        ).values('product_id').annotate(
            total=Coalesce(Sum('quantity'), Decimal('0'), output_field=DecimalField())
        )
        prev_map = {r['product_id']: float(r['total']) for r in prev if r['product_id'] in product_ids}

        trends = {}
        for pid in product_ids:
            r = recent_map.get(pid, 0)
            p = prev_map.get(pid, 0)
            if p == 0 and r == 0:
                trends[pid] = 'STABLE'
            elif p == 0:
                trends[pid] = 'UP'
            else:
                change = (r - p) / p
                if change > 0.1:
                    trends[pid] = 'UP'
                elif change < -0.1:
                    trends[pid] = 'DOWN'
                else:
                    trends[pid] = 'STABLE'
        return trends

    def _serialize_product(self, product, stock_info=None, trend=None):
        """Serialize a single product with stock data and trend."""
        si = stock_info or {}
        return {
            'id': product.id,
            'name': product.name,
            'sku': product.sku,
            'barcode': product.barcode,
            'brand_id': product.brand_id,
            'brand_name': product.brand.name if product.brand else None,
            'parfum_id': product.parfum_id,
            'parfum_name': product.parfum.name if product.parfum else None,
            'category_id': product.category_id,
            'category_name': product.category.name if product.category else None,
            'product_group_id': product.product_group_id,
            'product_group_name': product.product_group.name if product.product_group else None,
            'country_of_origin_id': product.country_of_origin_id,
            'country_of_origin_name': (
                product.country_of_origin.name
                if product.country_of_origin else None
            ),
            'size': float(product.size) if product.size else None,
            'size_unit': product.size_unit.name if product.size_unit else None,
            'size_label': (
                f"{product.size}{product.size_unit.short_name if product.size_unit and hasattr(product.size_unit, 'short_name') else product.size_unit.name if product.size_unit else ''}"
                if product.size else None
            ),
            'unit': product.unit.name if product.unit else None,
            'cost_price': float(product.cost_price),
            'selling_price_ttc': float(product.selling_price_ttc),
            'image_url': product.image_url,
            'trend': trend or 'STABLE',
            'stock': {
                'on_hand': float(si.get('on_hand', 0)),
                'reserved': float(si.get('reserved', 0)),
                'available': float(si.get('available', 0)),
            }
        }

    @action(detail=False, methods=['get'], url_path='by-country')
    def by_country(self, request):
        """
        View 1: Stock grouped by Country → Brand → Variant Attributes → Products.

        Returns:
        {
            countries: [
                {
                    country_id, country_name, country_code,
                    total_stock, product_count,
                    brands: [
                        {
                            brand_id, brand_name,
                            total_stock, product_count,
                            variants: [
                                {
                                    variant_name, attr_group_name,
                                    total_stock, product_count,
                                    products: [{ ...product, stock }]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        """
        qs = self._apply_filters(request)
        product_ids = list(qs.values_list('id', flat=True))

        # Get stock
        warehouse_ids = self._parse_ids(request, 'warehouse_ids')
        country_ids = self._parse_ids(request, 'stock_country_ids')
        branch_ids = self._parse_ids(request, 'branch_ids')
        stock_map = self._get_product_stock(product_ids, warehouse_ids, country_ids, branch_ids)

        # Get trends
        trend_map = self._get_product_trends(set(product_ids))

        # Prefetch attribute values for all products
        from apps.inventory.models.product_models import ProductAttributeValue, ProductAttribute
        attr_values = ProductAttributeValue.objects.filter(
            product_id__in=product_ids
        ).select_related('attribute', 'attribute__parent').only(
            'product_id', 'attribute_id', 'attribute__name', 'attribute__parent__name'
        )
        # Map: product_id -> list of { attr_name, group_name }
        product_attrs = defaultdict(list)
        for av in attr_values:
            product_attrs[av.product_id].append({
                'attr_id': av.attribute_id,
                'attr_name': av.attribute.name,
                'group_name': av.attribute.parent.name if av.attribute.parent else 'Other',
            })

        # Build tree: country → brand → variant → products
        country_tree = defaultdict(lambda: {
            'country_id': None,
            'country_name': 'Unknown Origin',
            'country_code': '',
            'total_stock': 0,
            'product_count': 0,
            'brands': defaultdict(lambda: {
                'brand_id': None,
                'brand_name': 'Unbranded',
                'total_stock': 0,
                'product_count': 0,
                'variants': defaultdict(lambda: {
                    'variant_name': 'No Variant',
                    'attr_group_name': '',
                    'total_stock': 0,
                    'product_count': 0,
                    'products': [],
                })
            })
        })

        for product in qs:
            # Country: prefer country_of_origin, fall back to country (legacy)
            c_id = product.country_of_origin_id or getattr(product, 'country_id', None) or 0
            c_node = country_tree[c_id]
            if product.country_of_origin:
                c_node['country_id'] = product.country_of_origin_id
                c_node['country_name'] = product.country_of_origin.name
                c_node['country_code'] = getattr(product.country_of_origin, 'code', '')
            elif hasattr(product, 'country') and product.country:
                c_node['country_id'] = product.country_id
                c_node['country_name'] = product.country.name
                c_node['country_code'] = getattr(product.country, 'code', '')

            # Brand
            b_id = product.brand_id or 0
            b_node = c_node['brands'][b_id]
            if product.brand:
                b_node['brand_id'] = product.brand_id
                b_node['brand_name'] = product.brand.name

            # Variant: use product attributes, or parfum as fallback
            attrs = product_attrs.get(product.id, [])
            variant_key = None
            variant_name = 'No Variant'
            group_name = ''
            if attrs:
                # Use first variant attribute
                variant_key = attrs[0]['attr_id']
                variant_name = attrs[0]['attr_name']
                group_name = attrs[0]['group_name']
            elif product.parfum:
                variant_key = f"parfum_{product.parfum_id}"
                variant_name = product.parfum.name
                group_name = 'Parfum'
            else:
                variant_key = 'none'

            v_node = b_node['variants'][variant_key]
            v_node['variant_name'] = variant_name
            v_node['attr_group_name'] = group_name

            stock_info = stock_map.get(product.id, {})
            serialized = self._serialize_product(product, stock_info, trend=trend_map.get(product.id))
            v_node['products'].append(serialized)
            on_hand = float(stock_info.get('on_hand', 0))
            v_node['total_stock'] += on_hand
            v_node['product_count'] += 1
            b_node['total_stock'] += on_hand
            b_node['product_count'] += 1
            c_node['total_stock'] += on_hand
            c_node['product_count'] += 1

        # Flatten to list
        result = []
        for c_id, c_data in sorted(country_tree.items(), key=lambda x: x[1]['country_name']):
            brands_list = []
            for b_id, b_data in sorted(c_data['brands'].items(), key=lambda x: x[1]['brand_name']):
                variants_list = []
                for v_key, v_data in sorted(b_data['variants'].items(), key=lambda x: x[1]['variant_name']):
                    variants_list.append({
                        'variant_name': v_data['variant_name'],
                        'attr_group_name': v_data['attr_group_name'],
                        'total_stock': v_data['total_stock'],
                        'product_count': v_data['product_count'],
                        'products': v_data['products'],
                    })
                brands_list.append({
                    'brand_id': b_data['brand_id'],
                    'brand_name': b_data['brand_name'],
                    'total_stock': b_data['total_stock'],
                    'product_count': b_data['product_count'],
                    'variants': variants_list,
                })
            result.append({
                'country_id': c_data['country_id'],
                'country_name': c_data['country_name'],
                'country_code': c_data['country_code'],
                'total_stock': c_data['total_stock'],
                'product_count': c_data['product_count'],
                'brands': brands_list,
            })

        return Response({'countries': result})

    @action(detail=False, methods=['get'], url_path='by-product')
    def by_product(self, request):
        """
        View 2: Stock grouped by Product Group, then by Parfum, then by Country × Size.

        Returns:
        {
            product_groups: [
                {
                    group_id, group_name, brand_name, total_stock,
                    parfums: [
                        {
                            parfum_id, parfum_name, total_stock,
                            country_sizes: [
                                {
                                    country_id, country_name, size_label,
                                    stock, product: { ...product }
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        """
        qs = self._apply_filters(request)
        product_ids = list(qs.values_list('id', flat=True))

        warehouse_ids = self._parse_ids(request, 'warehouse_ids')
        country_ids = self._parse_ids(request, 'stock_country_ids')
        branch_ids = self._parse_ids(request, 'branch_ids')
        stock_map = self._get_product_stock(product_ids, warehouse_ids, country_ids, branch_ids)

        # Get trends
        trend_map = self._get_product_trends(set(product_ids))

        # Group: product_group > parfum > (country × size)
        group_tree = defaultdict(lambda: {
            'group_id': None,
            'group_name': '',
            'brand_id': None,
            'brand_name': '',
            'image_url': None,
            'total_stock': 0,
            'product_count': 0,
            'parfums': defaultdict(lambda: {
                'parfum_id': None,
                'parfum_name': 'No Variant',
                'total_stock': 0,
                'country_sizes': [],
            })
        })

        for product in qs:
            g_key = product.product_group_id or f"brand_{product.brand_id or 0}_cat_{product.category_id or 0}"
            g_node = group_tree[g_key]
            g_node['group_id'] = product.product_group_id
            g_node['group_name'] = (
                product.product_group.name if product.product_group
                else product.brand.name if product.brand
                else product.name
            )
            g_node['brand_id'] = product.brand_id
            g_node['brand_name'] = product.brand.name if product.brand else ''
            if not g_node['image_url'] and product.image_url:
                g_node['image_url'] = product.image_url

            p_key = product.parfum_id or 0
            p_node = g_node['parfums'][p_key]
            if product.parfum:
                p_node['parfum_id'] = product.parfum_id
                p_node['parfum_name'] = product.parfum.name

            stock_info = stock_map.get(product.id, {})
            on_hand = float(stock_info.get('on_hand', 0))

            p_node['country_sizes'].append({
                'country_id': product.country_of_origin_id,
                'country_name': (
                    product.country_of_origin.name
                    if product.country_of_origin else 'Unknown'
                ),
                'country_code': (
                    getattr(product.country_of_origin, 'code', '')
                    if product.country_of_origin else ''
                ),
                'size': float(product.size) if product.size else None,
                'size_label': (
                    f"{product.size}{product.size_unit.short_name if product.size_unit and hasattr(product.size_unit, 'short_name') else product.size_unit.name if product.size_unit else 'ml'}"
                    if product.size else None
                ),
                'stock': on_hand,
                'available': float(stock_info.get('available', 0)),
                'cost_price': float(product.cost_price),
                'selling_price': float(product.selling_price_ttc),
                'product': self._serialize_product(product, stock_info, trend=trend_map.get(product.id)),
            })

            p_node['total_stock'] += on_hand
            g_node['total_stock'] += on_hand
            g_node['product_count'] += 1

        # Flatten
        result = []
        for g_key, g_data in sorted(group_tree.items(), key=lambda x: x[1]['group_name']):
            parfums_list = []
            for p_key, p_data in sorted(g_data['parfums'].items(), key=lambda x: x[1]['parfum_name']):
                parfums_list.append({
                    'parfum_id': p_data['parfum_id'],
                    'parfum_name': p_data['parfum_name'],
                    'total_stock': p_data['total_stock'],
                    'country_sizes': sorted(
                        p_data['country_sizes'],
                        key=lambda x: (x['country_name'], x['size'] or 0)
                    ),
                })
            result.append({
                'group_id': g_data['group_id'],
                'group_name': g_data['group_name'],
                'brand_id': g_data['brand_id'],
                'brand_name': g_data['brand_name'],
                'image_url': g_data['image_url'],
                'total_stock': g_data['total_stock'],
                'product_count': g_data['product_count'],
                'parfums': parfums_list,
            })

        return Response({'product_groups': result})

    @action(detail=False, methods=['get'], url_path='filters')
    def available_filters(self, request):
        """Return available filter options for the matrix UI."""
        org = request.organization

        countries = list(
            Product.objects.filter(organization=org, country_of_origin__isnull=False)
            .values('country_of_origin_id', 'country_of_origin__name')
            .annotate(count=Count('id'))
            .order_by('country_of_origin__name')
        )

        brands = list(
            Brand.objects.filter(organization=org)
            .values('id', 'name')
            .annotate(product_count=Count('products'))
            .order_by('name')
        )

        product_groups = list(
            ProductGroup.objects.filter(organization=org)
            .values('id', 'name')
            .annotate(product_count=Count('products'))
            .order_by('name')
        )

        parfums = list(
            Parfum.objects.filter(organization=org)
            .values('id', 'name')
            .annotate(product_count=Count('products'))
            .order_by('name')
        )

        warehouses = list(
            Warehouse.objects.filter(organization=org, is_active=True)
            .values('id', 'name', 'location_type', 'country__name')
            .order_by('name')
        )

        return Response({
            'countries': [
                {'id': c['country_of_origin_id'], 'name': c['country_of_origin__name'], 'count': c['count']}
                for c in countries
            ],
            'brands': [
                {'id': b['id'], 'name': b['name'], 'count': b['product_count']}
                for b in brands
            ],
            'product_groups': [
                {'id': g['id'], 'name': g['name'], 'count': g['product_count']}
                for g in product_groups
            ],
            'parfums': [
                {'id': p['id'], 'name': p['name'], 'count': p['product_count']}
                for p in parfums
            ],
            'warehouses': [
                {'id': w['id'], 'name': w['name'], 'type': w['location_type'], 'country': w['country__name']}
                for w in warehouses
            ],
        })

    def _apply_filters(self, request):
        """Apply query param filters to the product queryset."""
        qs = self.get_queryset()

        # Filter by country of origin
        origin_ids = self._parse_ids(request, 'origin_country_ids')
        if origin_ids:
            qs = qs.filter(country_of_origin_id__in=origin_ids)

        # Filter by brand
        brand_ids = self._parse_ids(request, 'brand_ids')
        if brand_ids:
            qs = qs.filter(brand_id__in=brand_ids)

        # Filter by product group
        group_ids = self._parse_ids(request, 'group_ids')
        if group_ids:
            qs = qs.filter(product_group_id__in=group_ids)

        # Filter by parfum
        parfum_ids = self._parse_ids(request, 'parfum_ids')
        if parfum_ids:
            qs = qs.filter(parfum_id__in=parfum_ids)

        # Filter by category
        category_ids = self._parse_ids(request, 'category_ids')
        if category_ids:
            qs = qs.filter(category_id__in=category_ids)

        # Search
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(sku__icontains=search) |
                Q(barcode__icontains=search) |
                Q(brand__name__icontains=search) |
                Q(parfum__name__icontains=search) |
                Q(product_group__name__icontains=search)
            )

        return qs.order_by('product_group__name', 'brand__name', 'parfum__name', 'size')

    def _parse_ids(self, request, param_name):
        """Parse comma-separated IDs from query params."""
        raw = request.query_params.get(param_name, '')
        if not raw:
            return []
        try:
            return [int(x.strip()) for x in raw.split(',') if x.strip()]
        except (ValueError, TypeError):
            return []

    @action(detail=False, methods=['get'], url_path='sales-periods')
    def sales_periods(self, request):
        """
        Sales Period Breakdown for a single product.

        GET /api/inventory/stock-matrix/sales-periods/?product_id=X&period_days=7&lookback_days=90

        Breaks total sales history into X-day windows so users can identify
        noise/peak periods and validate avg daily sales velocity.

        Returns:
        {
            product_id, product_name,
            period_days, lookback_days, total_periods,
            periods: [
                { period_num, period_start, period_end, qty_sold }
            ],
            avg_daily_sales, total_sold, needed_qty
        }
        """
        from apps.pos.models.pos_models import OrderLine

        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response(
                {'error': 'product_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            product_id = int(product_id)
        except (ValueError, TypeError):
            return Response(
                {'error': 'product_id must be an integer'},
                status=status.HTTP_400_BAD_REQUEST
            )

        period_days = int(request.query_params.get('period_days', 7))
        lookback_days = int(request.query_params.get('lookback_days', 90))
        org = request.organization

        # Get product info
        try:
            product = Product.objects.get(id=product_id, organization=org)
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        now = timezone.now()
        lookback_start = now - timedelta(days=lookback_days)

        # Get all completed sale line items for this product
        sale_lines = OrderLine.objects.filter(
            order__organization=org,
            order__type='SALE',
            order__order_status__in=['CONFIRMED', 'PROCESSING', 'CLOSED'],
            order__created_at__gte=lookback_start,
            product_id=product_id,
        ).select_related('order').values_list(
            'order__created_at', 'quantity'
        )

        # Build period buckets
        total_periods = lookback_days // period_days
        periods = []
        for i in range(total_periods):
            period_end = now - timedelta(days=i * period_days)
            period_start = now - timedelta(days=(i + 1) * period_days)
            periods.append({
                'period_num': i + 1,
                'period_start': period_start.date().isoformat(),
                'period_end': period_end.date().isoformat(),
                'qty_sold': 0,
            })

        # Fill buckets
        total_sold = 0
        for created_at, qty in sale_lines:
            qty_float = float(qty)
            total_sold += qty_float
            for p in periods:
                p_start = timezone.datetime.fromisoformat(p['period_start']).replace(
                    tzinfo=timezone.utc
                ) if isinstance(p['period_start'], str) else p['period_start']
                p_end = timezone.datetime.fromisoformat(p['period_end']).replace(
                    tzinfo=timezone.utc
                ) if isinstance(p['period_end'], str) else p['period_end']

                if p_start <= created_at < p_end:
                    p['qty_sold'] += qty_float
                    break

        # Reverse so oldest period is first
        periods.reverse()

        avg_daily_sales = round(total_sold / max(lookback_days, 1), 3)

        # Current stock for needed_qty calculation
        from apps.inventory.models import Inventory
        current_stock = float(
            Inventory.objects.filter(
                product_id=product_id, organization=org
            ).aggregate(
                total=Coalesce(Sum('quantity'), Decimal('0'), output_field=DecimalField())
            )['total']
        )
        needed_qty = max(0, round(avg_daily_sales * 30 - current_stock, 3))

        return Response({
            'product_id': product.id,
            'product_name': product.name,
            'period_days': period_days,
            'lookback_days': lookback_days,
            'total_periods': total_periods,
            'periods': periods,
            'avg_daily_sales': avg_daily_sales,
            'total_sold': round(total_sold, 3),
            'needed_qty': needed_qty,
            'current_stock': current_stock,
        })
