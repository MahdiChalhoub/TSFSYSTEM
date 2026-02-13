"""
Inventory Module Views
ViewSets for product catalog, stock management, warehouse operations, and product taxonomy.
"""
from django.db import transaction
from django.db.models import Q, Sum
from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from erp.models import Organization, Site
from erp.serializers import SiteSerializer

from apps.inventory.models import (
    Product, Unit, Warehouse, Inventory, InventoryMovement,
    Brand, Category, Parfum, ProductGroup
)
from apps.inventory.serializers import (
    ProductSerializer, ProductCreateSerializer, UnitSerializer,
    WarehouseSerializer, InventorySerializer, InventoryMovementSerializer,
    BrandSerializer, BrandDetailSerializer, CategorySerializer,
    ParfumSerializer, ProductGroupSerializer
)
from apps.inventory.services import InventoryService


class UnitViewSet(TenantModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer


class ProductViewSet(TenantModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def storefront(self, request):
        """
        Public endpoint for tenant storefronts.
        Requires organization_slug to isolate data.
        """
        slug = request.query_params.get('organization_slug')
        if not slug:
            return Response({"error": "Organization slug required"}, status=400)
            
        try:
            org = Organization.objects.get(slug=slug)
            products = Product.objects.filter(organization=org, status='ACTIVE')
            serializer = self.get_serializer(products, many=True)
            return Response(serializer.data)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=404)

    @action(detail=False, methods=['post'])
    def bulk_move(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        product_ids = request.data.get('productIds', [])
        target_id = request.data.get('targetId')
        move_type = request.data.get('type')

        if not product_ids or not target_id or not move_type:
            return Response({"error": "Missing parameters"}, status=400)

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
                products.update(**updates)
            
            return Response({"success": True, "count": products.count()})

    @action(detail=False, methods=['post'])
    def create_complex(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
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
                    brand = Brand.objects.get(id=brand_id)
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
            
            if not product.barcode and category_id:
                auto_barcode = f"P-{product.id}" 
                product.barcode = auto_barcode
                product.save()

            return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search_enhanced(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')
        
        from django.utils import timezone
        from datetime import timedelta
        
        products_qs = Product.objects.filter(organization=organization, status='ACTIVE')
        if query:
            products_qs = products_qs.filter(
                Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)
            )
        
        products_qs = products_qs[:10]
        
        data = []
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        for p in products_qs:
            stock_filter = {'organization': organization, 'product': p}
            if site_id:
                stock_filter['warehouse__site_id'] = site_id
                
            stock_level = Inventory.objects.filter(**stock_filter).aggregate(total=Sum('quantity'))['total'] or 0
            daily_sales = 0
            
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
                "dailySales": daily_sales,
                "proposedQty": max(0, int(daily_sales * 14 - stock_level))
            })
            
        return Response(data)


class WarehouseViewSet(TenantModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer


class InventoryViewSet(TenantModelViewSet):
    queryset = Inventory.objects.all()
    serializer_class = InventorySerializer

    def get_queryset(self):
        return super().get_queryset()

    @action(detail=False, methods=['post'])
    def receive_stock(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            product = Product.objects.get(id=request.data.get('product_id'))
            warehouse = Warehouse.objects.get(id=request.data.get('warehouse_id'))
            
            InventoryService.receive_stock(
                organization=organization,
                product=product,
                warehouse=warehouse,
                quantity=request.data.get('quantity'),
                cost_price_ht=request.data.get('cost_price_ht'),
                reference=request.data.get('reference', 'RECEPTION')
            )
            return Response({"message": "Stock received"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def adjust_stock(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        
        try:
            product = Product.objects.get(id=request.data.get('product_id'))
            warehouse = Warehouse.objects.get(id=request.data.get('warehouse_id'))
            
            InventoryService.adjust_stock(
                organization=organization,
                product=product,
                warehouse=warehouse,
                quantity=request.data.get('quantity'),
                reason=request.data.get('reason'),
                reference=request.data.get('reference')
            )
            return Response({"message": "Stock adjusted"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def valuation(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        status_data = InventoryService.get_inventory_valuation(organization)
        return Response(status_data)

    @action(detail=False, methods=['get'])
    def financial_status(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        status_data = InventoryService.get_inventory_financial_status(organization)
        return Response(status_data)

    @action(detail=False, methods=['get'])
    def viewer(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        search = request.query_params.get('search', '')
        
        products_qs = Product.objects.filter(organization=organization)
        if search:
            products_qs = products_qs.filter(
                Q(name__icontains=search) | Q(sku__icontains=search) | Q(barcode__icontains=search)
            )
        
        sites = Site.objects.filter(organization=organization, is_active=True)
        
        data = []
        for p in products_qs:
            site_stock = {}
            total_qty = 0
            for s in sites:
                qty = Inventory.objects.filter(
                    organization=organization,
                    product=p,
                    warehouse__site=s
                ).aggregate(total=Sum('quantity'))['total'] or 0
                site_stock[s.id] = float(qty)
                total_qty += float(qty)
            
            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "category": p.category.name if hasattr(p, 'category') and p.category else None,
                "brand": p.brand.name if hasattr(p, 'brand') and p.brand else None,
                "unit": p.unit.code if p.unit else None,
                "siteStock": site_stock,
                "totalQty": total_qty,
                "costPrice": float(p.cost_price)
            })
            
        return Response({
            "products": data,
            "sites": SiteSerializer(sites, many=True).data,
            "totalCount": len(data)
        })


class BrandViewSet(TenantModelViewSet):
    queryset = Brand.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BrandDetailSerializer
        return BrandSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
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

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            brand = Brand.objects.get(id=pk, organization=organization)
        except Brand.DoesNotExist:
            return Response({"error": "Brand not found"}, status=404)
        
        parfums = Parfum.objects.filter(
            organization=organization,
            id__in=Product.objects.filter(organization=organization, brand=brand).values_list('parfum_id', flat=True).distinct()
        )
        
        # Use BrandDetailSerializer to include nested countries
        brand_data = BrandDetailSerializer(brand).data
        
        hierarchy = {
            "brand": brand_data,
            "countries": list(brand.countries.values('id', 'code', 'name')),
            "productGroups": [],
            "products": [],
            "parfums": []
        }
        
        # Group products by parfum
        for parfum in parfums:
            products = Product.objects.filter(organization=organization, brand=brand, parfum=parfum)
            hierarchy["parfums"].append({
                "parfum": ParfumSerializer(parfum).data,
                "products": ProductSerializer(products, many=True).data
            })
        
        # Ungrouped products (no parfum)
        ungrouped = Product.objects.filter(organization=organization, brand=brand, parfum__isnull=True)
        if ungrouped.exists():
            hierarchy["parfums"].append({
                "parfum": {"id": None, "name": "Ungrouped"},
                "products": ProductSerializer(ungrouped, many=True).data
            })
        
        # Product groups belonging to this brand
        groups = ProductGroup.objects.filter(organization=organization, brand=brand)
        for group in groups:
            group_products = Product.objects.filter(organization=organization, product_group=group)
            hierarchy["productGroups"].append({
                "id": group.id,
                "name": group.name,
                "products": ProductSerializer(group_products, many=True).data
            })
        
        # Standalone products (no group)
        standalone = Product.objects.filter(organization=organization, brand=brand, product_group__isnull=True)
        hierarchy["products"] = ProductSerializer(standalone, many=True).data
        
        return Response(hierarchy)


class CategoryViewSet(TenantModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    @action(detail=False, methods=['get'])
    def with_counts(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        categories = Category.objects.filter(organization=organization)
        
        data = []
        for cat in categories:
            count = Product.objects.filter(organization=organization, category=cat).count()
            data.append({**CategorySerializer(cat).data, "productCount": count})
        
        return Response(data)

    @action(detail=False, methods=['post'])
    def move_products(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        product_ids = request.data.get('product_ids', [])
        target_category_id = request.data.get('target_category_id')
        
        if not product_ids or not target_category_id:
            return Response({"error": "Missing parameters"}, status=400)
        
        Product.objects.filter(id__in=product_ids, organization=organization).update(category_id=target_category_id)
        return Response({"success": True})


class ParfumViewSet(TenantModelViewSet):
    queryset = Parfum.objects.all()
    serializer_class = ParfumSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
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
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            parfum = Parfum.objects.get(id=pk, organization=organization)
        except Parfum.DoesNotExist:
            return Response({"error": "Parfum not found"}, status=404)
        
        brands = Brand.objects.filter(
            organization=organization,
            id__in=Product.objects.filter(organization=organization, parfum=parfum).values_list('brand_id', flat=True).distinct()
        )
        
        hierarchy = {
            "parfum": ParfumSerializer(parfum).data,
            "brands": []
        }
        
        for brand in brands:
            products = Product.objects.filter(organization=organization, parfum=parfum, brand=brand)
            hierarchy["brands"].append({
                "brand": BrandSerializer(brand).data,
                "products": ProductSerializer(products, many=True).data
            })
        
        return Response(hierarchy)


class ProductGroupViewSet(TenantModelViewSet):
    queryset = ProductGroup.objects.all()
    serializer_class = ProductGroupSerializer

    @action(detail=False, methods=['post'])
    def create_with_variants(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
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
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
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
                    Product.objects.filter(product_group=group, organization=organization).exclude(id__in=existing_ids).update(product_group=None)
                
                return Response(ProductGroupSerializer(group).data)
        except ProductGroup.DoesNotExist:
            return Response({"error": "Product Group not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def link_products(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            group = ProductGroup.objects.get(id=pk, organization=organization)
            product_ids = request.data.get('product_ids', [])
            
            Product.objects.filter(id__in=product_ids, organization=organization).update(product_group=group)
            
            return Response({"success": True, "count": len(product_ids)})
        except ProductGroup.DoesNotExist:
            return Response({"error": "Product Group not found"}, status=404)

    @action(detail=False, methods=['post'])
    def create_from_products(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
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
