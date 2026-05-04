"""
ViewSets for Product Grouping System.
InventoryGroup: stock aggregation and substitution intelligence.
ProductGroup sync actions: price sync, broken group detection.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import (
    Sum, Count, F, Q, Subquery, OuterRef, DecimalField, IntegerField
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from decimal import Decimal

from erp.views_base import TenantModelViewSet
from apps.inventory.models import Product, ProductGroup
from apps.inventory.models.grouping_models import InventoryGroup, InventoryGroupMember
from apps.inventory.serializers.grouping_serializers import (
    InventoryGroupSerializer, InventoryGroupListSerializer,
    InventoryGroupMemberSerializer,
    PricingGroupSerializer, PricingGroupListSerializer,
)


class InventoryGroupViewSet(TenantModelViewSet):
    """
    CRUD + intelligence for Inventory Groups (stock aggregation, substitution).
    """
    queryset = InventoryGroup.objects.none()
    serializer_class = InventoryGroupSerializer
    search_fields = ['name', 'commercial_size_label']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = InventoryGroup.objects.filter(
            organization=self.request.tenant
        )
        # Annotate with member count
        qs = qs.annotate(
            member_count=Count('members', filter=Q(members__is_active=True)),
        )
        # Filter by group_type
        group_type = self.request.query_params.get('group_type')
        if group_type:
            qs = qs.filter(group_type=group_type)
        # Filter by brand
        brand_id = self.request.query_params.get('brand')
        if brand_id:
            qs = qs.filter(brand_id=brand_id)
        # Active only
        active = self.request.query_params.get('active')
        if active == 'true':
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return InventoryGroupListSerializer
        return InventoryGroupSerializer

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Aggregated stock intelligence for the group."""
        group = self.get_object()
        from apps.inventory.models import Inventory

        members = InventoryGroupMember.objects.filter(
            group=group, is_active=True, organization=request.tenant
        ).select_related('product', 'product__country_of_origin', 'product__country', 'product__size_unit')

        variants = []
        total_stock = Decimal('0')
        countries = set()
        costs = []
        low_stock_count = 0

        for m in members:
            p = m.product
            stock = Inventory.objects.filter(
                product=p, organization=request.tenant
            ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))['total']

            total_stock += stock

            country = None
            if p.country_of_origin:
                country = p.country_of_origin.name
                countries.add(country)
            elif p.country:
                country = str(p.country)
                countries.add(country)

            cost = float(p.cost_price or 0)
            if cost > 0:
                costs.append(cost)

            is_low = stock < (p.min_stock_level or 10)
            if is_low:
                low_stock_count += 1

            variants.append({
                'product_id': p.id,
                'product_name': p.name,
                'product_sku': p.sku,
                'origin_label': m.origin_label or country,
                'country': country,
                'size': str(p.size) if p.size else None,
                'size_unit': p.size_unit.code if p.size_unit else None,
                'stock_qty': float(stock),
                'cost_price': float(p.cost_price or 0),
                'selling_price_ttc': float(p.selling_price_ttc or 0),
                'margin_pct': p.margin_pct,
                'substitution_role': m.substitution_role,
                'substitution_priority': m.substitution_priority,
                'is_low_stock': is_low,
            })

        # Sort by priority
        variants.sort(key=lambda v: v['substitution_priority'])

        # Compute analytics
        cheapest = min(variants, key=lambda v: v['cost_price']) if variants else None
        best_margin = max(variants, key=lambda v: v['margin_pct']) if variants else None

        return Response({
            'group_id': group.id,
            'group_name': group.name,
            'group_type': group.group_type,
            'total_stock': float(total_stock),
            'member_count': len(variants),
            'country_count': len(countries),
            'countries': sorted(countries),
            'low_stock_variants': low_stock_count,
            'avg_cost': round(sum(costs) / len(costs), 2) if costs else 0,
            'cheapest_source': cheapest['product_name'] if cheapest else None,
            'best_margin_source': best_margin['product_name'] if best_margin else None,
            'variants': variants,
        })


class InventoryGroupMemberViewSet(TenantModelViewSet):
    """CRUD for group members."""
    queryset = InventoryGroupMember.objects.none()
    serializer_class = InventoryGroupMemberSerializer
    search_fields = ['product__name', 'origin_label']

    def get_queryset(self):
        qs = InventoryGroupMember.objects.filter(
            organization=self.request.tenant
        ).select_related('product', 'product__country_of_origin', 'product__size_unit')
        product_id = self.request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        group_id = self.request.query_params.get('group')
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(organization=self.request.tenant)


class PricingGroupViewSet(TenantModelViewSet):
    """
    Extended ProductGroup ViewSet with pricing mode operations.
    Adds sync, broken detection, and margin analysis actions.
    """
    queryset = ProductGroup.objects.none()
    serializer_class = PricingGroupSerializer
    search_fields = ['name']
    ordering_fields = ['name', 'pricing_mode']
    ordering = ['name']

    def get_queryset(self):
        qs = ProductGroup.objects.filter(
            organization=self.request.tenant
        )
        # Filter by pricing mode
        mode = self.request.query_params.get('pricing_mode')
        if mode:
            qs = qs.filter(pricing_mode=mode)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return PricingGroupListSerializer
        return PricingGroupSerializer

    @action(detail=True, methods=['post'])
    def sync_prices(self, request, pk=None):
        """
        Apply group price to all members.
        Respects pricing_mode, override_policy, rounding, and margin guards.
        """
        group = self.get_object()
        from apps.inventory.services.pricing_service import ProductGroupPricingService

        new_price = request.data.get('price_ttc')
        new_price_ht = request.data.get('price_ht')

        if new_price is not None:
            new_price = Decimal(str(new_price))

        if not new_price and not group.base_selling_price_ttc:
            return Response(
                {'error': 'No price specified and group has no base price'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # The service handles per-product pricing mode logic, rounding,
        # margin floor guards, and group_sync_status tracking.
        result = ProductGroupPricingService.sync_group_prices(
            group, new_price, new_price_ht
        )

        result['synced_at'] = (group.last_synced_at or timezone.now()).isoformat()
        return Response(result)

    @action(detail=True, methods=['get'])
    def check_broken(self, request, pk=None):
        """Detect which members have prices that diverge from the group."""
        group = self.get_object()
        expected = group.base_selling_price_ttc or Decimal('0')
        members = Product.objects.filter(
            product_group=group, organization=request.tenant
        )

        broken = []
        synced = []
        overridden = []

        for p in members:
            if p.pricing_source == 'LOCAL':
                overridden.append({
                    'id': p.id, 'name': p.name, 'sku': p.sku,
                    'current_price': float(p.selling_price_ttc or 0),
                    'expected_price': float(expected),
                    'status': 'LOCAL_OVERRIDE',
                })
            elif expected and p.selling_price_ttc != expected:
                broken.append({
                    'id': p.id, 'name': p.name, 'sku': p.sku,
                    'current_price': float(p.selling_price_ttc or 0),
                    'expected_price': float(expected),
                    'delta': float((p.selling_price_ttc or 0) - expected),
                    'status': 'BROKEN',
                })
                # Update sync status
                if p.group_sync_status != 'BROKEN':
                    p.group_sync_status = 'BROKEN'
                    p.group_broken_since = timezone.now()
                    p.group_expected_price = expected
                    p.save(update_fields=[
                        'group_sync_status', 'group_broken_since', 'group_expected_price'
                    ])
            else:
                synced.append({
                    'id': p.id, 'name': p.name, 'sku': p.sku,
                    'current_price': float(p.selling_price_ttc or 0),
                    'status': 'SYNCED',
                })

        return Response({
            'group_id': group.id,
            'group_name': group.name,
            'expected_price': float(expected),
            'total_members': members.count(),
            'synced_count': len(synced),
            'broken_count': len(broken),
            'overridden_count': len(overridden),
            'broken': broken,
            'synced': synced,
            'overridden': overridden,
        })

    @action(detail=True, methods=['post'])
    def margin_analysis(self, request, pk=None):
        """Analyze margin impact of a proposed price change."""
        group = self.get_object()
        proposed_price = request.data.get('proposed_price_ttc')
        if not proposed_price:
            return Response(
                {'error': 'proposed_price_ttc required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        proposed_price = Decimal(str(proposed_price))

        products = Product.objects.filter(
            product_group=group, organization=request.tenant
        )
        results = []
        negatives = 0
        below_floor = 0

        for p in products:
            cost = float(p.effective_cost or 0)
            new_sell = float(proposed_price)
            margin = round(((new_sell - cost) / new_sell * 100), 2) if new_sell > 0 else 0
            current_margin = p.margin_pct

            item = {
                'product_id': p.id,
                'product_name': p.name,
                'cost': cost,
                'current_price': float(p.selling_price_ttc or 0),
                'proposed_price': new_sell,
                'current_margin_pct': current_margin,
                'proposed_margin_pct': margin,
            }

            if margin < 0:
                item['severity'] = 'NEGATIVE_MARGIN'
                negatives += 1
            elif group.margin_floor_pct and margin < float(group.margin_floor_pct):
                item['severity'] = 'BELOW_FLOOR'
                below_floor += 1
            else:
                item['severity'] = 'OK'

            results.append(item)

        return Response({
            'proposed_price': float(proposed_price),
            'total_members': len(results),
            'negative_margin_count': negatives,
            'below_floor_count': below_floor,
            'margin_floor_pct': float(group.margin_floor_pct or 0),
            'products': results,
        })
