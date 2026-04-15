from django.db import transaction
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
# UNIT
# =============================================================================

class UnitViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    pagination_class = None  # Tree data — must return all units for hierarchy building
    filterset_fields = ['name']
    search_fields = ['name']

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


# =============================================================================
# BRAND
# =============================================================================

class BrandViewSet(TenantModelViewSet):
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

    @action(detail=False, methods=['get'])
    def with_counts(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        categories = Category.objects.filter(
            organization=organization
        ).annotate(
            annotated_product_count=Count('products', distinct=True),
            annotated_brand_count=Count('brands', distinct=True),
            annotated_parfum_count=Count('parfums', distinct=True),
            annotated_attribute_count=Count('attributes', distinct=True)
        )

        data = []
        for cat in categories:
            cat_data = CategorySerializer(cat).data
            cat_data["product_count"] = cat.annotated_product_count
            cat_data["brand_count"] = cat.annotated_brand_count
            cat_data["parfum_count"] = cat.annotated_parfum_count
            cat_data["attribute_count"] = cat.annotated_attribute_count
            data.append(cat_data)

        return Response(data)

    @action(detail=True, methods=['get'])
    def linked_brands(self, request, pk=None):
        """Return brands linked to this category via M2M, plus all brands for linking palette."""
        category = self.get_object()
        organization = category.organization

        linked = Brand.objects.filter(
            categories=category, organization=organization
        ).annotate(
            product_count=Count('products', filter=Q(products__category=category))
        ).values('id', 'name', 'logo', 'product_count')

        all_brands = Brand.objects.filter(
            organization=organization
        ).values('id', 'name').order_by('name')

        return Response({
            "linked": list(linked),
            "all": list(all_brands),
        })

    @action(detail=True, methods=['get'])
    def linked_attributes(self, request, pk=None):
        """Return attribute groups linked to this category via M2M."""
        category = self.get_object()
        organization = category.organization
        from apps.inventory.models import ProductAttribute

        linked = ProductAttribute.objects.filter(
            categories=category, organization=organization, parent__isnull=True
        ).values('id', 'name', 'code')

        all_attrs = ProductAttribute.objects.filter(
            organization=organization, parent__isnull=True
        ).values('id', 'name', 'code').order_by('name')

        return Response({
            "linked": list(linked),
            "all": list(all_attrs),
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
