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
    filterset_fields = ['name']
    search_fields = ['name']


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

    @action(detail=False, methods=['get'])
    def with_counts(self, request):
        organization, err = _get_org_or_400()
        if err: return err

        categories = Category.objects.filter(
            organization=organization
        ).annotate(
            annotated_product_count=Count('products', distinct=True),
            annotated_brand_count=Count('brands', distinct=True),
            annotated_parfum_count=Count('parfums', distinct=True)
        )

        data = []
        for cat in categories:
            cat_data = CategorySerializer(cat).data
            cat_data["product_count"] = cat.annotated_product_count
            cat_data["brand_count"] = cat.annotated_brand_count
            cat_data["parfum_count"] = cat.annotated_parfum_count
            data.append(cat_data)

        return Response(data)

    @action(detail=True, methods=['get'])
    def explore(self, request, pk=None):
        category = self.get_object()
        organization = category.organization

        brands = Brand.objects.filter(
            categories=category,
            organization=organization
        ).annotate(
            cat_product_count=Count('products', filter=Q(products__category=category))
        ).values('id', 'name', 'logo', 'cat_product_count')

        parfums = Parfum.objects.filter(
            categories=category,
            organization=organization
        ).annotate(
            cat_product_count=Count('products', filter=Q(products__category=category))
        ).values('id', 'name', 'cat_product_count')

        products = Product.objects.filter(
            category=category,
            organization=organization,
            is_active=True
        ).select_related('brand', 'parfum', 'unit')

        product_data = []
        for p in products:
            product_data.append({
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "brand_name": p.brand.name if p.brand else None,
                "parfum_name": p.parfum.name if p.parfum else None,
                "unit_code": p.unit.code if p.unit else None,
                "selling_price_ttc": float(p.selling_price_ttc),
                "image_url": p.image_url if hasattr(p, 'image_url') else None,
                "status": p.status
            })

        return Response({
            "brands": list(brands),
            "parfums": list(parfums),
            "products": product_data
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
        organization, err = _get_org_or_400()
        if err: return err

        product_ids = request.data.get('product_ids', [])
        target_category_id = request.data.get('target_category_id')

        Product.objects.filter(id__in=product_ids, organization=organization).update(category_id=target_category_id)
        return Response({"success": True})


# =============================================================================
# PARFUM
# =============================================================================

class ParfumViewSet(TenantModelViewSet):
    queryset = Parfum.objects.all()
    serializer_class = ParfumSerializer

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
