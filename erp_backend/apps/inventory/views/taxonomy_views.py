from django.db import models, transaction
from erp.models import Organization
from apps.inventory.models import (
    Brand,
    Category,
    Parfum,
    Product,
    ProductGroup,
    Unit,
)
from apps.inventory.serializers import (
    BrandDetailSerializer,
    BrandSerializer,
    CategorySerializer,
    ParfumSerializer,
    ProductGroupSerializer,
    ProductSerializer,
    StorefrontBrandSerializer,
    StorefrontCategorySerializer,
    UnitSerializer,
)
from .base import (
    AnonRateThrottle,
    Count,
    Q,
    Response,
    TenantModelViewSet,
    _get_org_or_400,
    action,
    permissions,
    status,
    transaction,
)
from erp.mixins import UDLEViewSetMixin


# =============================================================================
# DELETE PROTECTION HELPERS
# =============================================================================
# Before any destroy on Category/Unit/Brand/Attribute, we check whether
# any Product references this entity. If yes, return 409 with a product
# preview and barcode severity flag — the frontend uses this to show the
# migration UI.
#
# Bypass: pass `?force=1` on the DELETE request (only after user explicitly
# confirms in a warning dialog).

def _build_destroy_conflict(entity_name: str, products_qs, *, preview_limit: int = 20) -> dict | None:
    """Return a 409 payload dict if any products are linked, else None.

    NOTE: Django refuses `.filter()` on a sliced queryset (`TypeError:
    Cannot filter a query once a slice has been taken.`). Compute every
    filtered subset BEFORE slicing, then slice at the end.
    """
    count = products_qs.count()
    if count == 0:
        return None
    barcode_count = products_qs.filter(barcodes__is_active=True).distinct().count()
    # Preview = first N products. Filter full qs for barcodes FIRST, then slice.
    preview_ids = list(products_qs.values_list('id', flat=True)[:preview_limit])
    preview = list(
        products_qs.filter(id__in=preview_ids).values('id', 'sku', 'name', 'barcode')
    )
    barcode_ids_in_preview = set(
        products_qs.filter(id__in=preview_ids, barcodes__is_active=True)
        .values_list('id', flat=True)
    )
    for p in preview:
        p['has_barcode'] = p['id'] in barcode_ids_in_preview
    msg_suffix = f'{barcode_count} have active barcodes. ' if barcode_count else ''
    return {
        'error': 'conflict',
        'entity': entity_name,
        'affected_count': count,
        'barcode_count': barcode_count,
        'message': (
            f'{count} product{"s" if count != 1 else ""} assigned to this {entity_name}. '
            f'{msg_suffix}'
            f'Migrate them to another {entity_name} first, or re-send DELETE with ?force=1.'
        ),
        'products': preview,
    }


def _force_flag(request) -> bool:
    """Was ?force=1 passed on the destroy request? (explicit user override)"""
    return str(request.query_params.get('force', '')).lower() in ('1', 'true', 'yes')


# =============================================================================
# UNIT
# =============================================================================

class UnitViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    pagination_class = None  # Tree data — must return all units for hierarchy building
    filterset_fields = ['name']
    search_fields = ['name']

    def destroy(self, request, *args, **kwargs):
        """Guard: block delete when products reference this unit. Bypass with ?force=1."""
        instance = self.get_object()
        if not _force_flag(request):
            qs = Product.objects.filter(
                unit=instance, organization=instance.organization
            ).only('id', 'sku', 'name', 'barcode')
            conflict = _build_destroy_conflict('unit', qs)
            if conflict:
                return Response(conflict, status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def family_tree(self, request):
        """
        Return all units in the same family tree as the given unit.
        ?unit_id=<id> — walks up to root, then returns root + all descendants.
        Each unit includes `depth` (0 = root, 1 = first child, etc.).
        """
        organization, err = _get_org_or_400()
        if err:
            return err

        unit_id = request.query_params.get('unit_id')
        if not unit_id:
            return Response(
                {"error": "unit_id query param required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start_unit = Unit.objects.get(id=unit_id, organization=organization)
        except Unit.DoesNotExist:
            return Response({"error": "Unit not found"}, status=status.HTTP_404_NOT_FOUND)

        # Walk up to root
        root = start_unit
        while root.base_unit_id:
            try:
                root = Unit.objects.get(id=root.base_unit_id, organization=organization)
            except Unit.DoesNotExist:
                break

        # Collect entire tree via BFS
        tree = []
        queue = [(root, 0)]  # (unit, depth)
        while queue:
            node, depth = queue.pop(0)
            data = UnitSerializer(node).data
            data['depth'] = depth
            tree.append(data)
            children = Unit.objects.filter(base_unit=node, organization=organization)
            for child in children:
                queue.append((child, depth + 1))

        return Response(tree)

    @action(detail=True, methods=['get'])
    def linked_packaging(self, request, pk=None):
        """Return all ProductPackaging records that use this unit."""
        organization, err = _get_org_or_400()
        if err:
            return err
        try:
            unit = Unit.objects.get(id=pk, organization=organization)
        except Unit.DoesNotExist:
            return Response({"error": "Unit not found"}, status=status.HTTP_404_NOT_FOUND)

        from apps.inventory.models import ProductPackaging
        packagings = ProductPackaging.objects.filter(
            unit=unit, organization=organization
        ).select_related('product', 'unit')

        data = []
        for pkg in packagings:
            data.append({
                'id': pkg.id,
                'name': pkg.name or pkg.display_name,
                'sku': pkg.sku,
                'barcode': pkg.barcode,
                'ratio': float(pkg.ratio),
                'level': pkg.level,
                'is_default_sale': pkg.is_default_sale,
                'is_default_purchase': pkg.is_default_purchase,
                'selling_price': float(pkg.effective_selling_price),
                'product_id': pkg.product_id,
                'product_name': pkg.product.name if pkg.product else None,
                'product_sku': pkg.product.sku if pkg.product else None,
            })
        return Response(data)

    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):
        """Return products that use this unit, with optional search/filter/sort."""
        organization, err = _get_org_or_400()
        if err:
            return err
        try:
            unit = Unit.objects.get(id=pk, organization=organization)
        except Unit.DoesNotExist:
            return Response({"error": "Unit not found"}, status=status.HTTP_404_NOT_FOUND)

        products = Product.objects.filter(unit=unit, organization=organization)

        # Search
        q = request.query_params.get('search', '').strip()
        if q:
            products = products.filter(
                models.Q(name__icontains=q) | models.Q(sku__icontains=q) | models.Q(barcode__icontains=q)
            )

        # Filters
        category_id = request.query_params.get('category')
        if category_id:
            products = products.filter(category_id=category_id)
        brand_id = request.query_params.get('brand')
        if brand_id:
            products = products.filter(brand_id=brand_id)
        status_filter = request.query_params.get('status')
        if status_filter:
            products = products.filter(status=status_filter)

        # Sort
        sort = request.query_params.get('sort', 'name')
        sort_map = {
            'name': 'name', '-name': '-name',
            'price': 'selling_price_ttc', '-price': '-selling_price_ttc',
            'sku': 'sku', '-sku': '-sku',
            'created': '-created_at',
        }
        products = products.order_by(sort_map.get(sort, 'name'))

        # Pagination
        page_size = int(request.query_params.get('page_size', 50))
        page = int(request.query_params.get('page', 1))
        total = products.count()
        products = products[(page - 1) * page_size:page * page_size]

        data = []
        for p in products.select_related('category', 'brand', 'unit'):
            data.append({
                'id': p.id,
                'name': p.name,
                'sku': p.sku,
                'barcode': p.barcode,
                'selling_price_ttc': float(p.selling_price_ttc or 0),
                'selling_price_ht': float(p.selling_price_ht or 0),
                'cost_price': float(p.cost_price or 0),
                'status': p.status,
                'category_name': p.category.name if p.category else None,
                'brand_name': p.brand.name if p.brand else None,
                'unit_name': p.unit.name if p.unit else None,
            })
        return Response({'results': data, 'count': total, 'page': page, 'page_size': page_size})

    @action(detail=True, methods=['get'])
    def explore(self, request, pk=None):
        """Rich product listing for a unit — pagination, search, sort, stock, filter_options.
        Mirrors CategoryViewSet.explore for EntityProductsTab compatibility."""
        organization, err = _get_org_or_400()
        if err:
            return err
        try:
            unit = Unit.objects.get(id=pk, organization=organization)
        except Unit.DoesNotExist:
            return Response({"error": "Unit not found"}, status=status.HTTP_404_NOT_FOUND)

        PAGE_SIZE = 50
        offset = int(request.query_params.get('offset', 0))
        search = request.query_params.get('search', '').strip()

        products_qs = Product.objects.filter(
            unit=unit, organization=organization
        ).select_related('brand', 'category', 'unit')

        # Server-side search
        if search:
            from django.db.models import Q as Qf
            products_qs = products_qs.filter(
                Qf(name__icontains=search) | Qf(sku__icontains=search) | Qf(barcode__icontains=search)
            )

        # Server-side sorting
        sort_by = request.query_params.get('sort', 'name')
        sort_dir = request.query_params.get('sort_dir', 'asc')
        order_prefix = '' if sort_dir == 'asc' else '-'

        # Annotate stock_on_hand from StockLedger.
        # Previously used a nested Subquery with OuterRef(OuterRef('pk')) which is an invalid
        # double-wrap — Django rejects it at SQL compile time with
        # "This queryset contains a reference to an outer query and may only be used in a subquery."
        # The annotation succeeded but iteration crashed the whole endpoint with a 500.
        # Fix: compute "latest-per-warehouse" stock via a single non-nested Subquery.
        from django.db.models import Sum, Subquery, OuterRef, DecimalField, Value
        from django.db.models.functions import Coalesce
        try:
            from apps.inventory.models import StockLedger
            # Latest ledger row per (product, warehouse) within this org.
            # Using a correlated subquery to fetch the running_on_hand sum.
            latest_per_wh = StockLedger.objects.filter(
                product=OuterRef('pk'),
                organization=organization,
            ).order_by('warehouse', '-created_at').distinct('warehouse').values('id')

            products_qs = products_qs.annotate(
                stock_on_hand=Coalesce(
                    Sum(
                        'stock_ledger__running_on_hand',
                        filter=Q(stock_ledger__id__in=Subquery(latest_per_wh)),
                    ),
                    Value(0),
                    output_field=DecimalField(),
                )
            )
            # Force-evaluate at annotation time so any SQL compile error is caught here
            # (not at iteration) and we can fall back cleanly.
            str(products_qs.query)
        except Exception as e:
            import logging
            logging.getLogger('explore').warning("stock_on_hand annotation failed, using 0: %s", e)
            products_qs = products_qs.annotate(
                stock_on_hand=Value(0, output_field=DecimalField())
            )

        if sort_by == 'stock':
            products_qs = products_qs.order_by(f'{order_prefix}stock_on_hand', 'name')
        elif sort_by == 'price':
            products_qs = products_qs.order_by(f'{order_prefix}selling_price_ttc', 'name')
        else:
            products_qs = products_qs.order_by(f'{order_prefix}name')

        total_count = products_qs.count()
        products_page = products_qs[offset:offset + PAGE_SIZE]

        product_data = []
        for p in products_page:
            sell_ht = float(p.selling_price_ht) if p.selling_price_ht else 0
            cost = float(p.cost_price) if p.cost_price else 0
            margin_pct = round(((sell_ht - cost) / cost * 100), 1) if cost > 0 else None
            product_data.append({
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "product_type": p.product_type,
                "brand_id": p.brand_id,
                "brand_name": p.brand.name if p.brand else None,
                "category_id": p.category_id,
                "category_name": p.category.name if p.category else None,
                "unit_code": p.unit.code if p.unit else None,
                "selling_price_ttc": float(p.selling_price_ttc or 0),
                "selling_price_ht": sell_ht,
                "cost_price": cost,
                "tva_rate": float(p.tva_rate) if p.tva_rate else 0,
                "margin_pct": margin_pct,
                "stock_on_hand": float(p.stock_on_hand) if hasattr(p, 'stock_on_hand') else 0,
                "status": p.status,
            })

        # Build filter options from ALL products using this unit (not just the page)
        filter_options = {}
        if offset == 0:
            all_prods = Product.objects.filter(unit=unit, organization=organization)
            filter_options = {
                "brands": sorted(
                    [{"value": n, "label": n} for n in all_prods.exclude(brand__isnull=True).values_list('brand__name', flat=True).distinct() if n],
                    key=lambda x: x["label"]
                ),
                "categories": sorted(
                    [{"value": n, "label": n} for n in all_prods.exclude(category__isnull=True).values_list('category__name', flat=True).distinct() if n],
                    key=lambda x: x["label"]
                ),
                "statuses": sorted(
                    [{"value": s, "label": s.capitalize()} for s in all_prods.values_list('status', flat=True).distinct() if s]
                ),
                "types": sorted(
                    [{"value": t, "label": t} for t in all_prods.values_list('product_type', flat=True).distinct() if t],
                    key=lambda x: x["label"]
                ),
                "tva_rates": sorted(
                    [{"value": str(r), "label": f"{r}%"} for r in all_prods.values_list('tva_rate', flat=True).distinct() if r is not None],
                    key=lambda x: float(x["value"])
                ),
            }

        return Response({
            "products": product_data,
            "total_count": total_count,
            "has_more": (offset + PAGE_SIZE) < total_count,
            "next_offset": offset + PAGE_SIZE if (offset + PAGE_SIZE) < total_count else None,
            "filter_options": filter_options,
        })

    @action(detail=False, methods=['post'])
    def move_products(self, request):
        """Bulk reassign products to a different unit.

        Body:
            product_ids: list[int]
            target_unit_id: int
            preview: bool (default False) — if True, returns analysis without moving
        """
        organization, err = _get_org_or_400()
        if err:
            return err

        product_ids = request.data.get('product_ids', [])
        target_unit_id = request.data.get('target_unit_id')
        preview = request.data.get('preview', False)
        # Bulk shortcut: migrate every product with unit=source_unit_id
        source_unit_id = request.data.get('source_unit_id')
        if source_unit_id and not product_ids:
            product_ids = list(
                Product.objects.filter(
                    unit_id=source_unit_id, organization=organization
                ).values_list('id', flat=True)
            )

        if not product_ids or not target_unit_id:
            return Response(
                {"error": "product_ids and target_unit_id are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_unit = Unit.objects.get(id=target_unit_id, organization=organization)
        except Unit.DoesNotExist:
            return Response({"error": "Target unit not found"}, status=status.HTTP_404_NOT_FOUND)

        products = Product.objects.filter(
            id__in=product_ids, organization=organization
        )

        if not products.exists():
            return Response({"error": "No valid products found"}, status=status.HTTP_400_BAD_REQUEST)

        if preview:
            return Response({
                "has_conflicts": False,
                "target_unit": {"id": target_unit.id, "name": target_unit.name},
                "product_count": products.count(),
            })

        with transaction.atomic():
            moved = products.update(unit=target_unit)

        return Response({
            "success": True,
            "moved_count": moved,
            "target_unit": {"id": target_unit.id, "name": target_unit.name},
        })


# =============================================================================
# UNIT PACKAGE
# =============================================================================

class UnitPackageViewSet(TenantModelViewSet):
    """CRUD for per-unit package templates (Pack of 6, Carton 24, etc.).
    Filterable by ?unit=<id>.

    NOTE: soft-delete (is_archived) arrives with migration 0058. Until then
    destroy() hard-deletes after the 409 guard passes.
    """
    pagination_class = None

    def get_serializer_class(self):
        from apps.inventory.serializers import UnitPackageSerializer
        return UnitPackageSerializer

    def get_queryset(self):
        from apps.inventory.models import UnitPackage
        qs = UnitPackage.objects.all().select_related('unit', 'parent')
        unit_id = self.request.query_params.get('unit')
        if unit_id:
            qs = qs.filter(unit_id=unit_id)
        return qs.order_by('unit_id', 'order', 'ratio')

    def destroy(self, request, *args, **kwargs):
        """Guard: block delete when the template is referenced by children
        (chain descendants), ProductPackaging rows, or PackagingSuggestionRule
        rows. On conflict return 409 with counts + preview. Bypass with
        ?force=1 — which currently hard-deletes; once migration 0058 lands
        this will archive (soft-delete) instead.
        """
        from apps.inventory.models import UnitPackage, ProductPackaging, PackagingSuggestionRule

        instance = self.get_object()
        org = instance.organization

        children_qs = UnitPackage.objects.filter(parent=instance, organization=org)
        # ProductPackaging has no FK to UnitPackage — match by unit + ratio
        # (the same signature the suggestion engine uses to identify a level).
        packaging_qs = ProductPackaging.objects.filter(
            unit=instance.unit, ratio=instance.ratio, organization=org
        ).select_related('product')
        rules_qs = PackagingSuggestionRule.objects.filter(
            packaging=instance, organization=org
        )

        if not _force_flag(request):
            children_count = children_qs.count()
            packaging_count = packaging_qs.count()
            rules_count = rules_qs.count()
            if children_count or packaging_count or rules_count:
                preview = list(
                    packaging_qs.values('id', 'product_id', 'product__name', 'product__sku')[:20]
                )
                for p in preview:
                    p['product_name'] = p.pop('product__name')
                    p['product_sku'] = p.pop('product__sku')
                msg_parts = []
                if children_count:
                    msg_parts.append(f'{children_count} child template{"s" if children_count != 1 else ""} in the chain')
                if packaging_count:
                    msg_parts.append(f'{packaging_count} product packaging row{"s" if packaging_count != 1 else ""}')
                if rules_count:
                    msg_parts.append(f'{rules_count} suggestion rule{"s" if rules_count != 1 else ""}')
                return Response({
                    'error': 'conflict',
                    'entity': 'unit-package',
                    'affected_count': children_count + packaging_count + rules_count,
                    'children_count': children_count,
                    'packaging_count': packaging_count,
                    'rules_count': rules_count,
                    'message': (
                        f'Cannot delete "{instance.name}" — referenced by {", ".join(msg_parts)}. '
                        f'Re-send DELETE with ?force=1 to proceed anyway.'
                    ),
                    'products': preview,
                }, status=status.HTTP_409_CONFLICT)

        return super().destroy(request, *args, **kwargs)


class ProductPackagingViewSet(TenantModelViewSet):
    """Flat list of ProductPackaging rows across ALL products.

    Each row is a first-class packaging (barcode, price, product) —
    e.g. "Coca Cola — Pack of 6" with its own barcode + price.
    Filterable by ?product=<id>, ?unit=<id>, ?has_barcode=1.
    """
    pagination_class = None

    def get_serializer_class(self):
        from apps.inventory.serializers import ProductPackagingSerializer
        return ProductPackagingSerializer

    def get_queryset(self):
        from apps.inventory.models import ProductPackaging
        qs = ProductPackaging.objects.select_related(
            'product', 'product__category', 'product__brand',
            'unit',
        )
        for key in ('product', 'unit', 'level'):
            v = self.request.query_params.get(key)
            if v:
                qs = qs.filter(**{f'{key}_id' if key in ('product', 'unit') else key: v})
        if self.request.query_params.get('has_barcode') == '1':
            qs = qs.exclude(barcode__isnull=True).exclude(barcode='')
        if self.request.query_params.get('active') == '1':
            qs = qs.filter(is_active=True)
        return qs.order_by('product__name', 'level', 'ratio')


# =============================================================================
# PACKAGING SUGGESTION RULE — smart engine
# =============================================================================

class PackagingSuggestionRuleViewSet(TenantModelViewSet):
    """CRUD for packaging suggestion rules + /suggest/ endpoint that returns
    ranked suggestions based on (category, brand, attribute, attribute_value)."""
    pagination_class = None

    def get_serializer_class(self):
        from apps.inventory.serializers import PackagingSuggestionRuleSerializer
        return PackagingSuggestionRuleSerializer

    def get_queryset(self):
        from apps.inventory.models import PackagingSuggestionRule
        qs = PackagingSuggestionRule.objects.select_related(
            'category', 'brand', 'attribute', 'packaging', 'packaging__unit'
        )
        for key in ('category', 'brand', 'attribute', 'packaging'):
            v = self.request.query_params.get(key)
            if v:
                qs = qs.filter(**{f'{key}_id': v})
        return qs

    @action(detail=False, methods=['get'], url_path='suggest')
    def suggest(self, request):
        """
        Return packaging suggestions ranked by priority.

        Query params (all optional, any combination):
          ?category=<id>
          ?brand=<id>
          ?attribute=<id>
          ?attribute_value=<string>

        Rules where a dimension is NULL act as wildcards for that dimension.
        So a rule { category=Tissue, brand=NULL } matches any brand of Tissue.
        """
        from apps.inventory.models import PackagingSuggestionRule
        from django.db.models import Q as Qf

        category = request.query_params.get('category')
        brand = request.query_params.get('brand')
        attribute = request.query_params.get('attribute')
        attribute_value = request.query_params.get('attribute_value')

        qs = PackagingSuggestionRule.objects.select_related(
            'category', 'brand', 'attribute', 'packaging', 'packaging__unit'
        )

        # Category filter: match this category OR wildcard (NULL)
        if category:
            qs = qs.filter(Qf(category_id=category) | Qf(category__isnull=True))
        else:
            qs = qs.filter(category__isnull=True)

        if brand:
            qs = qs.filter(Qf(brand_id=brand) | Qf(brand__isnull=True))
        else:
            qs = qs.filter(brand__isnull=True)

        if attribute:
            if attribute_value:
                qs = qs.filter(
                    Qf(attribute_id=attribute, attribute_value=attribute_value)
                    | Qf(attribute_id=attribute, attribute_value__isnull=True)
                    | Qf(attribute_id=attribute, attribute_value='')
                    | Qf(attribute__isnull=True)
                )
            else:
                qs = qs.filter(Qf(attribute_id=attribute) | Qf(attribute__isnull=True))
        else:
            qs = qs.filter(attribute__isnull=True)

        rules = list(qs)

        # Sort by effective priority (desc), then usage_count (desc), then recency
        rules.sort(key=lambda r: (-r.effective_priority(), -r.usage_count, -r.id))

        # Deduplicate by packaging_id — keep the highest-priority rule per packaging
        seen = set()
        deduped = []
        for r in rules:
            if r.packaging_id in seen:
                continue
            seen.add(r.packaging_id)
            deduped.append(r)

        from apps.inventory.serializers import PackagingSuggestionRuleSerializer
        data = PackagingSuggestionRuleSerializer(deduped, many=True).data
        return Response({
            'count': len(data),
            'suggestions': data,
            'filters': {
                'category': category, 'brand': brand,
                'attribute': attribute, 'attribute_value': attribute_value,
            },
        })

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        """Bump usage_count when a user accepts this suggestion. Powers
        the 'most-used-first' ordering over time."""
        rule = self.get_object()
        rule.usage_count = (rule.usage_count or 0) + 1
        rule.save(update_fields=['usage_count', 'updated_at'])
        from apps.inventory.serializers import PackagingSuggestionRuleSerializer
        return Response(PackagingSuggestionRuleSerializer(rule).data)


# =============================================================================
# BRAND
# =============================================================================

class BrandViewSetDeleteGuardMixin:
    def destroy(self, request, *args, **kwargs):
        """Guard: block delete when products reference this brand. Bypass with ?force=1."""
        instance = self.get_object()
        if not _force_flag(request):
            qs = Product.objects.filter(
                brand=instance, organization=instance.organization
            ).only('id', 'sku', 'name', 'barcode')
            conflict = _build_destroy_conflict('brand', qs)
            if conflict:
                return Response(conflict, status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)


class BrandViewSet(BrandViewSetDeleteGuardMixin, TenantModelViewSet):
    queryset = Brand.objects.all()
    pagination_class = None  # Taxonomy data — return all brands for tree building

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BrandDetailSerializer
        return BrandSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        category_id = request.query_params.get('category_id') or request.query_params.get('categoryId')

        brands = Brand.objects.filter(organization=organization)
        if category_id:
            product_brand_ids = Product.objects.filter(
                organization=organization,
                category_id=category_id
            ).values_list('brand_id', flat=True).distinct()
            brands = brands.filter(id__in=product_brand_ids)

        serializer = BrandSerializer(brands, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def move_products(self, request):
        """
        Bulk-reassign products from one brand to another (or to unbranded).
        Used by the delete-protection migration flow.

        Body:
          source_brand_id (required): brand to move away from
          target_brand_id (optional): brand to assign — omit/null to clear brand
          also_delete_source (default false): after successful migration,
            delete the source brand (only if empty now)
        """
        organization, err = _get_org_or_400()
        if err: return err

        source_id = request.data.get('source_brand_id')
        target_id = request.data.get('target_brand_id')
        also_delete = bool(request.data.get('also_delete_source'))
        if not source_id:
            return Response({'error': 'source_brand_id is required'}, status=400)

        try:
            source = Brand.objects.get(id=source_id, organization=organization)
        except Brand.DoesNotExist:
            return Response({'error': 'Source brand not found'}, status=404)

        target = None
        if target_id:
            try:
                target = Brand.objects.get(id=target_id, organization=organization)
            except Brand.DoesNotExist:
                return Response({'error': 'Target brand not found'}, status=404)

        with transaction.atomic():
            updated = Product.objects.filter(
                brand=source, organization=organization
            ).update(brand=target)
            deleted = False
            if also_delete:
                remaining = Product.objects.filter(brand=source, organization=organization).count()
                if remaining == 0:
                    source.delete()
                    deleted = True
        return Response({
            'status': 'moved', 'products_updated': updated,
            'source_deleted': deleted,
        })

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        organization, err = _get_org_or_400()
        if err: return err

        try:
            brand = Brand.objects.get(id=pk, organization=organization)
        except Brand.DoesNotExist:
            return Response({"error": "Brand not found"}, status=status.HTTP_404_NOT_FOUND)

        all_products = list(Product.objects.filter(
            organization=organization, brand=brand
        ).select_related('category', 'unit', 'parfum', 'country', 'size_unit', 'product_group'))

        parfum_groups = {}
        ungrouped = []
        for p in all_products:
            if p.parfum_id:
                parfum_groups.setdefault(p.parfum_id, []).append(p)
            else:
                ungrouped.append(p)

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

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny], authentication_classes=[], throttle_classes=[AnonRateThrottle])
    def storefront(self, request):
        organization_slug = request.query_params.get('organization_slug')
        if not organization_slug:
            return Response({"error": "organization_slug required"}, status=400)

        try:
            organization = Organization.objects.get(slug=organization_slug)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=404)

        brands = Brand.objects.filter(
            organization=organization,
            products__is_active=True
        ).distinct()

        serializer = StorefrontBrandSerializer(brands, many=True)
        return Response(serializer.data)


# =============================================================================
# CATEGORY
# =============================================================================

class CategoryViewSet(TenantModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    pagination_class = None  # Tree data — must return all categories for hierarchy building

    def destroy(self, request, *args, **kwargs):
        """Guard: block delete when products reference this category OR child
        categories exist. Bypass with ?force=1 (still leaves children orphaned
        as SET_NULL children inherit category deletion)."""
        instance = self.get_object()
        if not _force_flag(request):
            # Check for child categories — forbid outright; parent re-assignment
            # should happen explicitly via the Move tool, not a blind delete.
            child_count = Category.objects.filter(
                parent=instance, organization=instance.organization
            ).count()
            if child_count > 0:
                return Response({
                    'error': 'conflict',
                    'entity': 'category',
                    'affected_count': child_count,
                    'message': f'{child_count} sub-categor{"ies" if child_count != 1 else "y"} nested under this category. Move them to another parent first, or re-send DELETE with ?force=1.',
                    'children': True,
                }, status=status.HTTP_409_CONFLICT)

            qs = Product.objects.filter(
                category=instance, organization=instance.organization
            ).only('id', 'sku', 'name', 'barcode')
            conflict = _build_destroy_conflict('category', qs)
            if conflict:
                return Response(conflict, status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def with_counts(self, request):
        """Categories list annotated with product / brand / parfum / attribute
        counts. CategorySerializer owns the union logic (auto + explicit) —
        single source of truth so row badges and detail-tab badges always
        agree. Counts are bulk-prefetched via `prefetch_counts` to avoid N+1.
        """
        organization, err = _get_org_or_400()
        if err: return err

        categories = Category.objects.filter(organization=organization)
        ctx = CategorySerializer.prefetch_counts(organization)
        return Response(CategorySerializer(categories, many=True, context=ctx).data)

    @action(detail=True, methods=['get'])
    def linked_brands(self, request, pk=None):
        """
        Return brands linked to this category — auto-derived from product data.
        A brand is 'linked' if ANY product in this category uses that brand.
        Also includes explicit M2M links (pre-registration).
        """
        category = self.get_object()
        organization = category.organization
        from apps.inventory.models import Product

        # Auto-derived: distinct brands used by products in this category
        auto_brand_ids = set(
            Product.objects.filter(
                category=category, organization=organization, brand__isnull=False
            ).values_list('brand_id', flat=True).distinct()
        )

        # Explicit M2M links (pre-registration)
        explicit_brand_ids = set(
            Brand.objects.filter(
                categories=category, organization=organization
            ).values_list('id', flat=True)
        )

        # Union of both
        all_linked_ids = auto_brand_ids | explicit_brand_ids

        linked = []
        if all_linked_ids:
            brands_qs = Brand.objects.filter(
                id__in=all_linked_ids, organization=organization
            ).annotate(
                product_count=Count('products', filter=Q(products__category=category))
            )
            for b in brands_qs:
                source = 'both' if b.id in auto_brand_ids and b.id in explicit_brand_ids \
                    else 'auto' if b.id in auto_brand_ids else 'explicit'
                linked.append({
                    'id': b.id, 'name': b.name, 'logo': b.logo,
                    'product_count': b.product_count, 'source': source,
                })

        all_brands = Brand.objects.filter(
            organization=organization
        ).values('id', 'name').order_by('name')

        return Response({
            "linked": linked,
            "all": list(all_brands),
        })

    @action(detail=True, methods=['post'])
    def link_brand(self, request, pk=None):
        """Pre-register a brand to this category (explicit M2M link)."""
        category = self.get_object()
        brand_id = request.data.get('brand_id')
        try:
            brand = Brand.objects.get(id=brand_id, organization=category.organization)
            brand.categories.add(category)
            return Response({"status": "linked", "brand": brand.name})
        except Brand.DoesNotExist:
            return Response({"error": "Brand not found"}, status=404)

    @action(detail=True, methods=['post'])
    def unlink_brand(self, request, pk=None):
        """
        Remove a brand from this category. Protected: if products in this
        category use this brand, return 409 with conflict details. Barcode-
        aware (matches unlink_attribute): highlights products with active
        barcodes (extra severity).

        Pass `force=true` (body) or `?force=1` (query) to bypass the guard
        and remove the explicit M2M link even when products still reference
        the brand. Products keep their `brand` FK — only the explicit
        category↔brand pre-registration link is removed.
        """
        category = self.get_object()
        organization = category.organization
        brand_id = request.data.get('brand_id')
        force = (
            str(request.data.get('force', '')).lower() in ('1', 'true', 'yes')
            or str(request.query_params.get('force', '')).lower() in ('1', 'true', 'yes')
        )
        from apps.inventory.models import Product

        try:
            brand = Brand.objects.get(id=brand_id, organization=organization)
        except Brand.DoesNotExist:
            return Response({"error": "Brand not found"}, status=404)

        # Check for product conflicts
        conflicting = Product.objects.filter(
            category=category, brand=brand, organization=organization
        ).select_related('brand').only('id', 'sku', 'name', 'barcode')

        count = conflicting.count()
        if count > 0 and not force:
            barcode_count = conflicting.filter(barcodes__is_active=True).distinct().count()
            products_preview = list(
                conflicting[:20].values('id', 'sku', 'name', 'barcode')
            )
            barcode_ids = set(
                conflicting[:20].filter(barcodes__is_active=True).values_list('id', flat=True)
            )
            for p in products_preview:
                p['has_barcode'] = p['id'] in barcode_ids
            return Response({
                "error": "conflict",
                "entity": "brand",
                "message": (
                    f'{count} product{"s" if count != 1 else ""} in this category use brand "{brand.name}". '
                    f'{f"{barcode_count} have active barcodes. " if barcode_count else ""}'
                    f'Reassign them to a different brand before unlinking, or force-unlink to remove '
                    f'the pre-registration only (products keep the brand FK).'
                ),
                "affected_count": count,
                "barcode_count": barcode_count,
                "products": products_preview,
            }, status=409)

        # Safe (or forced) — remove explicit M2M only
        brand.categories.remove(category)
        return Response({"status": "unlinked", "brand": brand.name, "forced": bool(force and count > 0)})

    @action(detail=True, methods=['get'])
    def linked_attributes(self, request, pk=None):
        """
        Return attribute groups linked to this category — auto-derived from product data.
        An attribute group is 'linked' if ANY product in this category uses a child value of that group.
        Also includes explicit M2M links (pre-registration).
        """
        category = self.get_object()
        organization = category.organization
        from apps.inventory.models import ProductAttribute, Product

        # Auto-derived: attribute groups used by products in this category
        # Products have attribute_values (leaf nodes) → get their parent (root group) IDs
        auto_group_ids = set(
            ProductAttribute.objects.filter(
                products_with_attribute__category=category,
                products_with_attribute__organization=organization,
                parent__isnull=False  # leaf nodes only
            ).values_list('parent_id', flat=True).distinct()
        )

        # Explicit M2M links (pre-registration)
        explicit_group_ids = set(
            ProductAttribute.objects.filter(
                categories=category, organization=organization, parent__isnull=True
            ).values_list('id', flat=True)
        )

        # Union of both
        all_linked_ids = auto_group_ids | explicit_group_ids

        linked = []
        if all_linked_ids:
            groups_qs = ProductAttribute.objects.filter(
                id__in=all_linked_ids, organization=organization, parent__isnull=True
            ).order_by('name')
            for g in groups_qs:
                source = 'both' if g.id in auto_group_ids and g.id in explicit_group_ids \
                    else 'auto' if g.id in auto_group_ids else 'explicit'
                # Count distinct products in THIS category that use any leaf value of this group.
                # Also count how many of those have active barcodes — used by the UI to show
                # "🔒 N with barcodes" severity indicator.
                product_count = Product.objects.filter(
                    category=category, organization=organization,
                    attribute_values__parent_id=g.id,
                ).distinct().count()
                barcode_count = 0
                if product_count:
                    barcode_count = Product.objects.filter(
                        category=category, organization=organization,
                        attribute_values__parent_id=g.id,
                        barcodes__is_active=True,
                    ).distinct().count()
                linked.append({
                    'id': g.id, 'name': g.name, 'code': g.code, 'source': source,
                    'product_count': product_count,
                    'barcode_count': barcode_count,
                })

        all_attrs = ProductAttribute.objects.filter(
            organization=organization, parent__isnull=True
        ).values('id', 'name', 'code').order_by('name')

        return Response({
            "linked": linked,
            "all": list(all_attrs),
        })

    @action(detail=True, methods=['post'])
    def link_attribute(self, request, pk=None):
        """Pre-register an attribute group to this category (explicit M2M link)."""
        category = self.get_object()
        from apps.inventory.models import ProductAttribute
        attr_id = request.data.get('attribute_id')
        try:
            attr = ProductAttribute.objects.get(id=attr_id, organization=category.organization, parent__isnull=True)
            category.attributes.add(attr)
            return Response({"status": "linked", "attribute": attr.name})
        except ProductAttribute.DoesNotExist:
            return Response({"error": "Attribute group not found"}, status=404)

    @action(detail=True, methods=['post'])
    def unlink_attribute(self, request, pk=None):
        """
        Remove an attribute group from this category. Protected: if products
        in this category use values from this group, return 409 with conflict details.
        Barcode-aware: highlights products with active barcodes (extra severity).

        Pass `force=true` (body) or `?force=1` (query) to bypass the guard and
        remove the explicit M2M link even when products still reference values
        from this group. Products keep their attribute_values — only the explicit
        category↔attribute link is removed.
        """
        category = self.get_object()
        organization = category.organization
        from apps.inventory.models import ProductAttribute, Product
        attr_id = request.data.get('attribute_id')
        force = (
            str(request.data.get('force', '')).lower() in ('1', 'true', 'yes')
            or str(request.query_params.get('force', '')).lower() in ('1', 'true', 'yes')
        )

        try:
            attr = ProductAttribute.objects.get(id=attr_id, organization=organization, parent__isnull=True)
        except ProductAttribute.DoesNotExist:
            return Response({"error": "Attribute group not found"}, status=404)

        # Find child attribute values of this group
        child_ids = list(
            ProductAttribute.objects.filter(parent=attr, organization=organization).values_list('id', flat=True)
        )

        # Products in this category using any child value
        conflicting = Product.objects.filter(
            category=category, organization=organization,
            attribute_values__id__in=child_ids
        ).distinct().only('id', 'sku', 'name', 'barcode')

        count = conflicting.count()
        if count > 0 and not force:
            # Count those with active barcodes (extra severity)
            barcode_count = conflicting.filter(barcodes__is_active=True).distinct().count()
            products_preview = list(
                conflicting[:20].values('id', 'sku', 'name', 'barcode')
            )
            # Add has_barcode flag to each preview
            barcode_product_ids = set(
                conflicting[:20].filter(barcodes__is_active=True).values_list('id', flat=True)
            )
            for p in products_preview:
                p['has_barcode'] = p['id'] in barcode_product_ids

            return Response({
                "error": "conflict",
                "message": f'{count} product{"s" if count != 1 else ""} in this category use attributes from "{attr.name}". '
                           f'{f"{barcode_count} have active barcodes. " if barcode_count else ""}'
                           f'Reassign attribute values before unlinking.',
                "affected_count": count,
                "barcode_count": barcode_count,
                "products": products_preview,
            }, status=409)

        # Safe to unlink — remove explicit M2M
        category.attributes.remove(attr)
        return Response({"status": "unlinked", "attribute": attr.name})

    @action(detail=True, methods=['get'])
    def migrate_attribute_preview(self, request, pk=None):
        """
        Preview migration of attribute values from one group to another.
        Returns: list of source leaf values used by products in this category,
        so the UI can show a mapping form (for each source leaf → pick a target leaf).

        Query params:
          source_attribute_id (required): the group being removed
          target_attribute_id (optional): the group to migrate TO; if provided,
            also returns the target group's leaf values as mapping candidates.
        """
        category = self.get_object()
        organization = category.organization
        from apps.inventory.models import ProductAttribute, Product

        source_id = request.query_params.get('source_attribute_id')
        target_id = request.query_params.get('target_attribute_id')
        if not source_id:
            return Response({'error': 'source_attribute_id is required'}, status=400)

        try:
            source = ProductAttribute.objects.get(id=source_id, organization=organization, parent__isnull=True)
        except ProductAttribute.DoesNotExist:
            return Response({'error': 'Source attribute group not found'}, status=404)

        # Source leaf values that are ACTIVELY used by products in this category
        source_leaf_ids_in_use = set(
            Product.objects.filter(
                category=category, organization=organization,
                attribute_values__parent_id=source.id,
            ).values_list('attribute_values__id', flat=True)
        )
        source_leaf_ids_in_use.discard(None)

        source_values = list(
            ProductAttribute.objects.filter(
                id__in=source_leaf_ids_in_use, organization=organization,
            ).annotate(
                product_count=models.Count(
                    'products_with_attribute',
                    filter=models.Q(products_with_attribute__category=category),
                    distinct=True,
                )
            ).values('id', 'name', 'code', 'product_count').order_by('name')
        )

        target_group = None
        target_values = []
        if target_id:
            try:
                target = ProductAttribute.objects.get(id=target_id, organization=organization, parent__isnull=True)
                target_group = {'id': target.id, 'name': target.name, 'code': target.code}
                target_values = list(
                    ProductAttribute.objects.filter(parent=target, organization=organization)
                        .values('id', 'name', 'code').order_by('name')
                )
            except ProductAttribute.DoesNotExist:
                pass

        return Response({
            'source_group': {'id': source.id, 'name': source.name, 'code': source.code},
            'target_group': target_group,
            'source_values': source_values,
            'target_values': target_values,
            'affected_product_count': Product.objects.filter(
                category=category, organization=organization,
                attribute_values__parent_id=source.id,
            ).distinct().count(),
        })

    @action(detail=True, methods=['post'])
    def migrate_attribute(self, request, pk=None):
        """
        Migrate attribute values on products in this category from a source
        group to a target group, then unlink the source group.

        Body:
          source_attribute_id (required): group being replaced
          target_attribute_id (optional): group replacing it — if omitted, values are
            simply removed (no replacement)
          value_mapping (optional): {source_leaf_id: target_leaf_id|null}
            — null/missing = drop the source value without replacement
          unlink (default true): whether to also unlink source group from category

        Atomic per-product: each product's attribute_values are updated in one
        transaction, so a partial failure doesn't leave products in a mixed state.
        """
        from django.db import transaction
        from apps.inventory.models import ProductAttribute, Product

        category = self.get_object()
        organization = category.organization

        source_id = request.data.get('source_attribute_id')
        target_id = request.data.get('target_attribute_id')
        raw_mapping = request.data.get('value_mapping') or {}
        do_unlink = request.data.get('unlink', True)

        if not source_id:
            return Response({'error': 'source_attribute_id is required'}, status=400)

        try:
            source = ProductAttribute.objects.get(id=source_id, organization=organization, parent__isnull=True)
        except ProductAttribute.DoesNotExist:
            return Response({'error': 'Source attribute group not found'}, status=404)

        # Normalize mapping keys to int and validate values belong to target group (if provided)
        mapping: dict[int, int | None] = {}
        valid_target_leaf_ids: set[int] = set()
        if target_id:
            try:
                target = ProductAttribute.objects.get(id=target_id, organization=organization, parent__isnull=True)
            except ProductAttribute.DoesNotExist:
                return Response({'error': 'Target attribute group not found'}, status=404)
            valid_target_leaf_ids = set(
                ProductAttribute.objects.filter(parent=target, organization=organization)
                    .values_list('id', flat=True)
            )

        source_leaf_ids = set(
            ProductAttribute.objects.filter(parent=source, organization=organization)
                .values_list('id', flat=True)
        )

        for k, v in raw_mapping.items():
            try:
                sk = int(k)
            except (TypeError, ValueError):
                continue
            if sk not in source_leaf_ids:
                continue
            if v is None or v == '' or v == 'null':
                mapping[sk] = None
                continue
            try:
                tv = int(v)
            except (TypeError, ValueError):
                continue
            if target_id and tv not in valid_target_leaf_ids:
                return Response({
                    'error': f'Target value {tv} does not belong to target group {target_id}'
                }, status=400)
            mapping[sk] = tv

        # Bulk fetch (product_id → set of source leaf ids currently on it).
        # Single through-table scan instead of N queries.
        Through = Product.attribute_values.through
        current_rows = list(
            Through.objects.filter(
                product__category=category,
                product__organization=organization,
                productattribute_id__in=source_leaf_ids,
            ).values_list('product_id', 'productattribute_id')
        )
        if not current_rows:
            # Nothing to migrate; still honour the unlink request.
            with transaction.atomic():
                if do_unlink:
                    category.attributes.remove(source)
            return Response({
                'status': 'migrated', 'source_attribute': source.name,
                'target_attribute_id': target_id,
                'products_updated': 0, 'unlinked': bool(do_unlink),
            })

        by_product: dict[int, set[int]] = {}
        for pid, lid in current_rows:
            by_product.setdefault(pid, set()).add(lid)

        # Compute bulk deletes (source rows) and bulk inserts (mapped targets).
        # We skip inserts that would create duplicates by pre-fetching the
        # already-present target rows for the same products.
        affected_pids = list(by_product.keys())
        target_leaf_ids_used = {v for v in mapping.values() if v is not None}
        existing_targets: set[tuple[int, int]] = set()
        if target_leaf_ids_used:
            existing_targets = set(
                Through.objects.filter(
                    product_id__in=affected_pids,
                    productattribute_id__in=target_leaf_ids_used,
                ).values_list('product_id', 'productattribute_id')
            )

        inserts: list = []
        for pid, source_values_on_product in by_product.items():
            for sv in source_values_on_product:
                tv = mapping.get(sv)
                if tv is None:
                    continue
                key = (pid, tv)
                if key in existing_targets:
                    continue
                existing_targets.add(key)  # avoid dup inserts across loop
                inserts.append(Through(product_id=pid, productattribute_id=tv))

        with transaction.atomic():
            # 1) strip every source leaf from every affected product in ONE delete
            Through.objects.filter(
                product_id__in=affected_pids,
                productattribute_id__in=source_leaf_ids,
            ).delete()
            # 2) attach the mapped targets in ONE insert
            if inserts:
                Through.objects.bulk_create(inserts, ignore_conflicts=True)
            if do_unlink:
                category.attributes.remove(source)

        updated = len(affected_pids)

        return Response({
            'status': 'migrated',
            'source_attribute': source.name,
            'target_attribute_id': target_id,
            'products_updated': updated,
            'unlinked': bool(do_unlink),
        })

    @action(detail=True, methods=['get'])
    def explore(self, request, pk=None):
        category = self.get_object()
        organization = category.organization

        # Pagination params
        PAGE_SIZE = 50
        offset = int(request.query_params.get('offset', 0))
        search = request.query_params.get('search', '').strip()

        # Brands & parfums (only on first page to avoid redundant data)
        brands_data = []
        parfums_data = []
        if offset == 0:
            brands_data = list(Brand.objects.filter(
                categories=category,
                organization=organization
            ).annotate(
                cat_product_count=Count('products', filter=Q(products__category=category))
            ).values('id', 'name', 'logo', 'cat_product_count'))

            parfums_data = list(Parfum.objects.filter(
                categories=category,
                organization=organization
            ).annotate(
                cat_product_count=Count('products', filter=Q(products__category=category))
            ).values('id', 'name', 'cat_product_count'))

        # Products queryset
        products_qs = Product.objects.filter(
            category=category,
            organization=organization,
            is_active=True
        ).select_related('brand', 'parfum', 'unit')

        # Server-side search
        if search:
            from django.db.models import Q as Qf
            products_qs = products_qs.filter(
                Qf(name__icontains=search) | Qf(sku__icontains=search)
            )

        # Server-side sorting
        sort_by = request.query_params.get('sort', 'name')
        sort_dir = request.query_params.get('sort_dir', 'asc')
        order_prefix = '' if sort_dir == 'asc' else '-'

        # Annotate stock_on_hand from StockLedger (sum of latest running_on_hand per warehouse)
        from django.db.models import Sum, Subquery, OuterRef, DecimalField
        from django.db.models.functions import Coalesce
        try:
            from apps.inventory.models import StockLedger
            # Latest ledger entry per product (across all warehouses, sum of running_on_hand)
            products_qs = products_qs.annotate(
                stock_on_hand=Coalesce(
                    Sum('stock_ledger__running_on_hand',
                        filter=Qf(
                            stock_ledger__id__in=Subquery(
                                StockLedger.objects.filter(
                                    product=OuterRef(OuterRef('pk')),
                                    organization=organization,
                                ).order_by('warehouse', '-created_at').distinct('warehouse').values('id')
                            )
                        )),
                    0,
                    output_field=DecimalField()
                )
            )
        except Exception:
            # Graceful fallback if StockLedger is unavailable
            from django.db.models import Value
            products_qs = products_qs.annotate(
                stock_on_hand=Value(0, output_field=DecimalField())
            )

        if sort_by == 'stock':
            products_qs = products_qs.order_by(f'{order_prefix}stock_on_hand', 'name')
        elif sort_by == 'price':
            products_qs = products_qs.order_by(f'{order_prefix}selling_price_ttc', 'name')
        else:
            products_qs = products_qs.order_by(f'{order_prefix}name')

        total_count = products_qs.count()
        products_page = products_qs[offset:offset + PAGE_SIZE]

        product_data = []
        for p in products_page:
            sell_ht = float(p.selling_price_ht) if p.selling_price_ht else 0
            cost = float(p.cost_price) if p.cost_price else 0
            margin_pct = round(((sell_ht - cost) / cost * 100), 1) if cost > 0 else None
            product_data.append({
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "product_type": p.product_type,
                "brand_id": p.brand_id,
                "brand_name": p.brand.name if p.brand else None,
                "parfum_id": p.parfum_id,
                "parfum_name": p.parfum.name if p.parfum else None,
                "unit_code": p.unit.code if p.unit else None,
                "selling_price_ttc": float(p.selling_price_ttc),
                "selling_price_ht": sell_ht,
                "cost_price": cost,
                "tva_rate": float(p.tva_rate) if p.tva_rate else 0,
                "margin_pct": margin_pct,
                "stock_on_hand": float(p.stock_on_hand) if hasattr(p, 'stock_on_hand') else 0,
                "image_url": p.image_url if hasattr(p, 'image_url') else None,
                "status": p.status,
            })

        # Build filter options from ALL products in this category (not just the page)
        all_prods = Product.objects.filter(category=category, organization=organization, is_active=True)
        filter_options = {
            "brands": sorted(
                [{"value": n, "label": n} for n in all_prods.exclude(brand__isnull=True).values_list('brand__name', flat=True).distinct() if n],
                key=lambda x: x["label"]
            ),
            "statuses": sorted(
                [{"value": s, "label": s.capitalize()} for s in all_prods.values_list('status', flat=True).distinct() if s]
            ),
            "types": sorted(
                [{"value": t, "label": t} for t in all_prods.values_list('product_type', flat=True).distinct() if t],
                key=lambda x: x["label"]
            ),
            "units": sorted(
                [{"value": u, "label": u} for u in all_prods.exclude(unit__isnull=True).values_list('unit__code', flat=True).distinct() if u],
                key=lambda x: x["label"]
            ),
            "tva_rates": sorted(
                [{"value": str(r), "label": f"{r}%"} for r in all_prods.values_list('tva_rate', flat=True).distinct() if r is not None],
                key=lambda x: float(x["value"])
            ),
        }

        return Response({
            "brands": brands_data,
            "parfums": parfums_data,
            "products": product_data,
            "total_count": total_count,
            "has_more": (offset + PAGE_SIZE) < total_count,
            "next_offset": offset + PAGE_SIZE if (offset + PAGE_SIZE) < total_count else None,
            "filter_options": filter_options,
        })

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny], authentication_classes=[], throttle_classes=[AnonRateThrottle])
    def storefront(self, request):
        organization_slug = request.query_params.get('organization_slug')
        if not organization_slug:
            return Response({"error": "organization_slug required"}, status=400)

        try:
            organization = Organization.objects.get(slug=organization_slug)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=404)

        categories = Category.objects.filter(
            organization=organization,
            products_count__gt=0
        )

        serializer = StorefrontCategorySerializer(categories, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def move_products(self, request):
        """Smart product move with brand/attribute conflict detection & reconciliation.

        Body:
            product_ids: list[int]
            target_category_id: int
            preview: bool (default False) — if True, returns conflict analysis without moving
            reconciliation: dict (optional) — decisions for conflicts:
                auto_link_brands: list[int]   — brand IDs to auto-link to target category
                auto_link_attributes: list[int] — attribute group IDs to auto-link to target category
        """
        from apps.inventory.models import ProductAttribute

        organization, err = _get_org_or_400()
        if err: return err

        product_ids = request.data.get('product_ids', [])
        target_category_id = request.data.get('target_category_id')
        preview = request.data.get('preview', False)
        reconciliation = request.data.get('reconciliation', {})
        # Bulk shortcut used by the DeleteConflictDialog: migrate every product
        # currently in source_category_id → target_category_id. Expands into
        # product_ids so the rest of the flow (conflict detection, M2M link
        # reconciliation) is unchanged.
        source_category_id = request.data.get('source_category_id')
        if source_category_id and not product_ids:
            product_ids = list(
                Product.objects.filter(
                    category_id=source_category_id, organization=organization
                ).values_list('id', flat=True)
            )

        if not product_ids or not target_category_id:
            return Response({"error": "product_ids and target_category_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_category = Category.objects.get(id=target_category_id, organization=organization)
        except Category.DoesNotExist:
            return Response({"error": "Target category not found"}, status=status.HTTP_404_NOT_FOUND)

        products = Product.objects.filter(
            id__in=product_ids, organization=organization
        ).select_related('brand', 'parfum')

        if not products.exists():
            return Response({"error": "No valid products found"}, status=status.HTTP_400_BAD_REQUEST)

        # ── Conflict Analysis ──
        # Brands linked to target category (M2M)
        target_brand_ids = set(target_category.brands.values_list('id', flat=True))
        # Attribute groups linked to target category (M2M)
        target_attr_ids = set(target_category.attributes.values_list('id', flat=True))

        # Collect unique brands & attributes from the moving products
        moving_brand_ids = set(p.brand_id for p in products if p.brand_id)
        # Get attribute groups linked to the SOURCE category of each product
        source_cat_ids = set(p.category_id for p in products if p.category_id)
        source_attr_ids = set()
        for cat_id in source_cat_ids:
            try:
                source_cat = Category.objects.get(id=cat_id, organization=organization)
                source_attr_ids.update(source_cat.attributes.values_list('id', flat=True))
            except Category.DoesNotExist:
                pass

        # Find conflicts
        brand_conflicts = moving_brand_ids - target_brand_ids
        attr_conflicts = source_attr_ids - target_attr_ids

        conflict_brands = []
        if brand_conflicts:
            for b in Brand.objects.filter(id__in=brand_conflicts, organization=organization):
                affected = [p.id for p in products if p.brand_id == b.id]
                conflict_brands.append({
                    "id": b.id, "name": b.name, "logo": b.logo,
                    "affected_product_ids": affected,
                    "affected_count": len(affected),
                })

        conflict_attrs = []
        if attr_conflicts:
            for a in ProductAttribute.objects.filter(id__in=attr_conflicts, organization=organization, parent__isnull=True):
                conflict_attrs.append({
                    "id": a.id, "name": a.name, "code": a.code,
                })

        has_conflicts = bool(conflict_brands or conflict_attrs)

        if preview:
            return Response({
                "has_conflicts": has_conflicts,
                "target_category": {"id": target_category.id, "name": target_category.name},
                "product_count": products.count(),
                "conflict_brands": conflict_brands,
                "conflict_attributes": conflict_attrs,
                "target_brands": list(target_category.brands.values('id', 'name')),
                "target_attributes": list(target_category.attributes.filter(parent__isnull=True).values('id', 'name')),
                "all_brands": list(Brand.objects.filter(organization=organization).values('id', 'name').order_by('name')),
                "all_attributes": list(ProductAttribute.objects.filter(organization=organization, parent__isnull=True).values('id', 'name').order_by('name')),
            })

        # ── Execute Move with Reconciliation ──
        # When the client sends NO reconciliation key (not even an empty object),
        # treat it as "resolve by auto-linking everything" — the ergonomic default.
        # This fixes the ugly "Unresolved brand conflicts: X" error when a caller
        # (e.g. the bulk source_category_id migrate path) forgets to pass it.
        # If the client sends reconciliation={} (explicit empty), we also auto-link
        # to keep the UX friendly; the UI can override by passing explicit choices.
        reconciliation_is_explicit = bool(
            reconciliation.get('auto_link_brands')
            or reconciliation.get('reassign_brands')
            or reconciliation.get('auto_link_attributes')
            or reconciliation.get('reassign_attributes')
        )
        if not reconciliation_is_explicit:
            auto_link_brands = list(brand_conflicts)
            auto_link_attrs = list(attr_conflicts)
            reassign_brands = {}
            reassign_attrs = {}
        else:
            auto_link_brands = reconciliation.get('auto_link_brands', [])
            reassign_brands = reconciliation.get('reassign_brands', {})  # {old_brand_id: new_brand_id}
            auto_link_attrs = reconciliation.get('auto_link_attributes', [])
            reassign_attrs = reconciliation.get('reassign_attributes', {})  # {old_attr_id: new_attr_id}

        # Validate: every conflicting brand must be either auto-linked or reassigned
        if brand_conflicts:
            resolved_brands = set(int(b) for b in auto_link_brands) | set(int(b) for b in reassign_brands.keys())
            unresolved = brand_conflicts - resolved_brands
            if unresolved:
                unresolved_names = list(Brand.objects.filter(id__in=unresolved).values_list('name', flat=True))
                return Response({
                    "error": f"Unresolved brand conflicts: {', '.join(unresolved_names)}. "
                             f"Each brand must be either linked to the target category or reassigned.",
                    "unresolved_brands": [{"id": bid, "name": n} for bid, n in
                                          zip(unresolved, unresolved_names)],
                }, status=status.HTTP_400_BAD_REQUEST)

        # Validate: every conflicting attribute must be auto-linked or reassigned
        if attr_conflicts:
            resolved_attrs = set(int(a) for a in auto_link_attrs) | set(int(a) for a in reassign_attrs.keys())
            unresolved_attrs = attr_conflicts - resolved_attrs
            if unresolved_attrs:
                unresolved_names = list(ProductAttribute.objects.filter(id__in=unresolved_attrs).values_list('name', flat=True))
                return Response({
                    "error": f"Unresolved attribute conflicts: {', '.join(unresolved_names)}. "
                             f"Each attribute group must be linked or reassigned.",
                    "unresolved_attributes": [{"id": aid, "name": n} for aid, n in
                                               zip(unresolved_attrs, unresolved_names)],
                }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # 1. Auto-link brands to target category
            if auto_link_brands:
                brands_to_link = Brand.objects.filter(id__in=auto_link_brands, organization=organization)
                target_category.brands.add(*brands_to_link)

            # 2. Reassign product brands
            for old_id_str, new_id in reassign_brands.items():
                old_id = int(old_id_str)
                new_brand = Brand.objects.filter(id=int(new_id), organization=organization).first()
                if new_brand:
                    Product.objects.filter(
                        id__in=product_ids, brand_id=old_id, organization=organization
                    ).update(brand_id=new_brand.id)

            # 3. Auto-link attribute groups to target category
            if auto_link_attrs:
                attrs_to_link = ProductAttribute.objects.filter(
                    id__in=auto_link_attrs, organization=organization, parent__isnull=True
                )
                target_category.attributes.add(*attrs_to_link)

            # 4. Reassign product attributes (swap old attribute group for new one)
            for old_id_str, new_id in reassign_attrs.items():
                old_id = int(old_id_str)
                new_attr = ProductAttribute.objects.filter(id=int(new_id), organization=organization, parent__isnull=True).first()
                if new_attr:
                    # For products that had the old attribute, swap it
                    for p in Product.objects.filter(id__in=product_ids, organization=organization):
                        p.attributes.remove(old_id)
                        p.attributes.add(new_attr.id)

            # 5. Move the products
            products.update(category_id=target_category_id)

        return Response({
            "success": True,
            "moved_count": len(product_ids),
            "brands_linked": len(auto_link_brands),
            "brands_reassigned": len(reassign_brands),
            "attributes_linked": len(auto_link_attrs),
        })


# =============================================================================
# PARFUM
# =============================================================================

class ParfumViewSet(TenantModelViewSet):
    queryset = Parfum.objects.all()
    serializer_class = ParfumSerializer
    pagination_class = None  # Taxonomy data — return all parfums

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        category_id = request.query_params.get('category_id') or request.query_params.get('categoryId')
        brand_id = request.query_params.get('brand_id') or request.query_params.get('brandId')

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

        all_products = list(Product.objects.filter(
            organization=organization, parfum=parfum
        ).select_related('brand', 'category', 'unit', 'country'))

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
            return Response({"error": "Product Group not found"}, status=status.HTTP_404_NOT_FOUND)
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
            return Response({"success": True})
        except ProductGroup.DoesNotExist:
            return Response({"error": "Product Group not found"}, status=status.HTTP_404_NOT_FOUND)
