"""
Product Attribute Tree ViewSet — V3 Dynamic Attributes + Brand Linking + Product Matrix
=======================================================================================
Handles CRUD for the self-referencing attribute tree.
Root nodes = attribute groups (Size, Color, Parfum).
Child nodes = attribute values (S, M, L, Red, Blue, Floral).
Includes Category ↔ Attribute linking, Brand ↔ Attribute linking, and Product Matrix.
"""
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers
from django.db.models import Count, Q, Prefetch
from erp.views_base import TenantModelViewSet
from apps.inventory.models import ProductAttribute, Category, Brand, Product


class ProductAttributeSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    children_count = serializers.IntegerField(read_only=True, default=0)
    products_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ProductAttribute
        fields = [
            'id', 'name', 'code', 'parent', 'parent_name',
            'is_variant', 'sort_order', 'color_hex', 'image_url',
            'show_in_name', 'name_position', 'short_label',
            'is_required', 'show_by_default', 'requires_barcode',
            'organization', 'children_count', 'products_count',
        ]
        read_only_fields = ['organization']


class LinkedCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']


class LinkedBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'name', 'logo']


class ProductAttributeTreeSerializer(serializers.ModelSerializer):
    """Nested serializer for tree view — root with children + linked categories + brands."""
    children = serializers.SerializerMethodField()
    children_count = serializers.IntegerField(read_only=True, default=0)
    products_count = serializers.IntegerField(read_only=True, default=0)
    linked_categories = serializers.SerializerMethodField()
    linked_brands = serializers.SerializerMethodField()

    class Meta:
        model = ProductAttribute
        fields = [
            'id', 'name', 'code', 'is_variant', 'sort_order',
            'color_hex', 'image_url',
            'show_in_name', 'name_position', 'short_label',
            'is_required', 'show_by_default', 'requires_barcode',
            'children', 'children_count',
            'products_count', 'linked_categories', 'linked_brands',
        ]

    def get_children(self, obj):
        children = getattr(obj, 'prefetched_children', obj.children.all())
        return ProductAttributeChildSerializer(children, many=True).data

    def get_linked_categories(self, obj):
        cats = getattr(obj, 'prefetched_categories', obj.categories.all())
        return LinkedCategorySerializer(cats, many=True).data

    def get_linked_brands(self, obj):
        brands_qs = getattr(obj, 'prefetched_brands', obj.brands.all())
        return LinkedBrandSerializer(brands_qs, many=True).data


class ProductAttributeChildSerializer(serializers.ModelSerializer):
    products_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ProductAttribute
        fields = [
            'id', 'name', 'code', 'sort_order', 'color_hex',
            'image_url', 'products_count',
        ]


class ProductAttributeViewSet(TenantModelViewSet):
    serializer_class = ProductAttributeSerializer
    queryset = ProductAttribute.objects.select_related('parent').all()

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request, 'organization', None)
        if org:
            qs = qs.filter(organization=org)
        else:
            qs = qs.none()

        # Annotate
        qs = qs.annotate(
            children_count=Count('children', distinct=True),
            products_count=Count('products_with_attribute', distinct=True),
        )

        # Filters
        parent = self.request.query_params.get('parent')
        if parent == 'null' or parent == 'root':
            qs = qs.filter(parent__isnull=True)
        elif parent:
            qs = qs.filter(parent_id=parent)

        is_variant = self.request.query_params.get('is_variant')
        if is_variant is not None:
            qs = qs.filter(is_variant=is_variant.lower() in ('true', '1'))

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))

        return qs.order_by('sort_order', 'name')

    def perform_create(self, serializer):
        org = getattr(self.request, 'organization', None)
        serializer.save(organization=org)

    @action(detail=False, methods=['get'], url_path='tree')
    def tree(self, request):
        """
        GET /api/inventory/product-attributes/tree/
        Returns all root attributes with nested children + linked categories + linked brands.
        """
        org = getattr(request, 'organization', None)
        if not org:
            return Response([])

        children_qs = ProductAttribute.objects.filter(
            organization=org, parent__isnull=False
        ).annotate(
            products_count=Count('products_with_attribute', distinct=True),
        ).order_by('sort_order', 'name')

        # Categories linked to this org
        categories_qs = Category.objects.filter(organization=org).order_by('name')

        # Brands linked to this org
        brands_qs = Brand.objects.filter(organization=org).order_by('name')

        roots = ProductAttribute.objects.filter(
            organization=org, parent__isnull=True
        ).annotate(
            children_count=Count('children', distinct=True),
            products_count=Count('products_with_attribute', distinct=True),
        ).prefetch_related(
            Prefetch('children', queryset=children_qs, to_attr='prefetched_children'),
            Prefetch('categories', queryset=categories_qs, to_attr='prefetched_categories'),
            Prefetch('brands', queryset=brands_qs, to_attr='prefetched_brands'),
        ).order_by('sort_order', 'name')

        serializer = ProductAttributeTreeSerializer(roots, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='link-categories')
    def link_categories(self, request, pk=None):
        """
        POST /api/inventory/product-attributes/<id>/link-categories/
        Body: { "category_ids": [1, 2, 3] }
        Sets the linked categories for this attribute group (replaces existing).
        """
        root = self.get_object()
        if root.parent_id is not None:
            return Response(
                {'error': 'Can only link categories to root attribute groups'},
                status=400
            )

        category_ids = request.data.get('category_ids', [])
        org = getattr(request, 'organization', None)

        # Validate categories belong to same org
        valid_cats = Category.objects.filter(
            id__in=category_ids, organization=org
        )
        root.categories.set(valid_cats)

        return Response({
            'status': 'ok',
            'linked': list(valid_cats.values_list('id', flat=True)),
        })

    @action(detail=True, methods=['post'], url_path='link-brands')
    def link_brands(self, request, pk=None):
        """
        POST /api/inventory/product-attributes/<id>/link-brands/
        Body: { "brand_ids": [1, 2, 3] }
        Sets the linked brands for this attribute group (replaces existing).
        """
        root = self.get_object()
        if root.parent_id is not None:
            return Response(
                {'error': 'Can only link brands to root attribute groups'},
                status=400
            )

        brand_ids = request.data.get('brand_ids', [])
        org = getattr(request, 'organization', None)

        valid_brands = Brand.objects.filter(
            id__in=brand_ids, organization=org
        )
        root.brands.set(valid_brands)

        return Response({
            'status': 'ok',
            'linked': list(valid_brands.values_list('id', flat=True)),
        })

    @action(detail=True, methods=['post'], url_path='add-category')
    def add_category(self, request, pk=None):
        """
        POST /api/inventory/product-attributes/<id>/add-category/
        Body: { "category_id": 5 }
        Adds a single category to this attribute group.
        """
        root = self.get_object()
        if root.parent_id is not None:
            return Response({'error': 'Can only link categories to root groups'}, status=400)

        category_id = request.data.get('category_id')
        org = getattr(request, 'organization', None)
        try:
            cat = Category.objects.get(id=category_id, organization=org)
            root.categories.add(cat)
            return Response({'status': 'ok', 'category': {'id': cat.id, 'name': cat.name}})
        except Category.DoesNotExist:
            return Response({'error': 'Category not found'}, status=404)

    @action(detail=True, methods=['post'], url_path='remove-category')
    def remove_category(self, request, pk=None):
        """
        POST /api/inventory/product-attributes/<id>/remove-category/
        Body: { "category_id": 5 }
        Removes a single category from this attribute group.
        """
        root = self.get_object()
        category_id = request.data.get('category_id')
        root.categories.remove(category_id)
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], url_path='add-value')
    def add_value(self, request, pk=None):
        """
        POST /api/inventory/product-attributes/<id>/add-value/
        Quick endpoint to add a child value to a root attribute.
        Body: { "name": "XL", "code": "xl", "color_hex": "#000" }
        """
        root = self.get_object()
        if root.parent_id is not None:
            return Response(
                {'error': 'Can only add values to root attribute groups'},
                status=400
            )

        org = getattr(request, 'organization', None)
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Name is required'}, status=400)

        child, created = ProductAttribute.objects.get_or_create(
            organization=org,
            parent=root,
            name=name,
            defaults={
                'code': request.data.get('code', name.lower().replace(' ', '_')),
                'color_hex': request.data.get('color_hex'),
                'image_url': request.data.get('image_url'),
                'sort_order': root.children.count(),
            }
        )
        return Response(
            ProductAttributeSerializer(child).data,
            status=201 if created else 200
        )

    @action(detail=True, methods=['post'], url_path='reorder')
    def reorder(self, request, pk=None):
        """
        POST /api/inventory/product-attributes/<id>/reorder/
        Body: { "order": [child_id_1, child_id_2, ...] }
        """
        root = self.get_object()
        order = request.data.get('order', [])
        for idx, child_id in enumerate(order):
            ProductAttribute.objects.filter(
                id=child_id, parent=root
            ).update(sort_order=idx)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['get'], url_path='product-matrix')
    def product_matrix(self, request):
        """
        GET /api/inventory/product-attributes/product-matrix/
        Returns products with dimension metadata for client-side grouping.
        Lightweight: no .only(), limited to 500 products, minimal joins.
        """
        org = getattr(request, 'organization', None)
        if not org:
            return Response({'products': [], 'dimensions': {}, 'total': 0})

        products = Product.objects.filter(
            organization=org, is_active=True
        ).select_related(
            'category', 'brand',
        ).prefetch_related(
            'attribute_values',
        ).order_by('name')[:500]  # Safety cap

        # Get all attribute groups for columns
        attr_groups = list(ProductAttribute.objects.filter(
            organization=org, parent__isnull=True
        ).prefetch_related('children').order_by('sort_order', 'name'))

        # Serialize products with all dimensions
        result = []
        for p in products:
            # Collect attribute values
            attr_vals = {}
            for av in p.attribute_values.all():
                if av.parent_id:
                    attr_vals[f'attr_{av.parent_id}'] = {
                        'id': av.id,
                        'name': av.name,
                        'group_id': av.parent_id,
                    }

            row = {
                'id': p.id,
                'name': p.name or '',
                'sku': p.sku or '',
                'barcode': p.barcode or '',
                'image_url': p.image_url or '',
                'selling_price': float(p.selling_price_ttc or 0),
                'cost_price': float(p.cost_price or 0),
                'category_id': p.category_id,
                'category_name': p.category.name if p.category_id else 'Uncategorized',
                'brand_id': p.brand_id,
                'brand_name': p.brand.name if p.brand_id else 'Unbranded',
                'country_id': p.country_id,
                'country_name': '',
                'attributes': attr_vals,
            }
            result.append(row)

        # Dimension metadata
        dimensions = {
            'category': {
                'key': 'category',
                'label': 'Category',
                'values': list(Category.objects.filter(
                    organization=org
                ).values('id', 'name').order_by('name'))
            },
            'brand': {
                'key': 'brand',
                'label': 'Brand',
                'values': list(Brand.objects.filter(
                    organization=org
                ).values('id', 'name').order_by('name'))
            },
        }

        # Add attribute groups as dimensions
        for ag in attr_groups:
            children = list(ag.children.all().values('id', 'name').order_by('sort_order', 'name'))
            dimensions[f'attr_{ag.id}'] = {
                'key': f'attr_{ag.id}',
                'label': ag.name,
                'is_attribute': True,
                'values': children,
            }

        return Response({
            'products': result,
            'dimensions': dimensions,
            'total': len(result),
        })

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        """
        POST /api/inventory/product-attributes/seed-defaults/
        Seeds common attributes for the current organization.
        """
        org = getattr(request, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'}, status=400)

        DEFAULTS = [
            {
                'name': 'Size', 'code': 'size', 'is_variant': True,
                'show_in_name': True, 'name_position': 1, 'short_label': None,
                'is_required': False, 'show_by_default': True, 'requires_barcode': False,
                'children': [
                    {'name': 'XS', 'code': 'xs'},
                    {'name': 'S', 'code': 's'},
                    {'name': 'M', 'code': 'm'},
                    {'name': 'L', 'code': 'l'},
                    {'name': 'XL', 'code': 'xl'},
                    {'name': 'XXL', 'code': 'xxl'},
                ]
            },
            {
                'name': 'Color', 'code': 'color', 'is_variant': False,
                'show_in_name': False, 'name_position': 99, 'short_label': None,
                'is_required': False, 'show_by_default': True, 'requires_barcode': False,
                'children': [
                    {'name': 'Black', 'code': 'black', 'color_hex': '#000000'},
                    {'name': 'White', 'code': 'white', 'color_hex': '#FFFFFF'},
                    {'name': 'Red', 'code': 'red', 'color_hex': '#EF4444'},
                    {'name': 'Blue', 'code': 'blue', 'color_hex': '#3B82F6'},
                    {'name': 'Green', 'code': 'green', 'color_hex': '#22C55E'},
                    {'name': 'Gold', 'code': 'gold', 'color_hex': '#EAB308'},
                    {'name': 'Silver', 'code': 'silver', 'color_hex': '#A1A1AA'},
                    {'name': 'Pink', 'code': 'pink', 'color_hex': '#EC4899'},
                ]
            },
            {
                'name': 'Fragrance Family', 'code': 'parfum_family', 'is_variant': False,
                'show_in_name': False, 'name_position': 99, 'short_label': None,
                'is_required': False, 'show_by_default': False, 'requires_barcode': False,
                'children': [
                    {'name': 'Floral', 'code': 'floral'},
                    {'name': 'Woody', 'code': 'woody'},
                    {'name': 'Oriental', 'code': 'oriental'},
                    {'name': 'Fresh', 'code': 'fresh'},
                    {'name': 'Citrus', 'code': 'citrus'},
                    {'name': 'Aquatic', 'code': 'aquatic'},
                    {'name': 'Gourmand', 'code': 'gourmand'},
                    {'name': 'Spicy', 'code': 'spicy'},
                    {'name': 'Oud', 'code': 'oud'},
                    {'name': 'Musky', 'code': 'musky'},
                ]
            },
            {
                'name': 'Concentration', 'code': 'concentration', 'is_variant': False,
                'show_in_name': True, 'name_position': 2, 'short_label': None,
                'is_required': False, 'show_by_default': False, 'requires_barcode': False,
                'children': [
                    {'name': 'EDP', 'code': 'edp'},
                    {'name': 'EDT', 'code': 'edt'},
                    {'name': 'Extrait', 'code': 'extrait'},
                    {'name': 'EDC', 'code': 'edc'},
                    {'name': 'Body Mist', 'code': 'body_mist'},
                ]
            },
            {
                'name': 'Gender', 'code': 'gender', 'is_variant': False,
                'show_in_name': False, 'name_position': 99, 'short_label': None,
                'is_required': False, 'show_by_default': True, 'requires_barcode': False,
                'children': [
                    {'name': 'Men', 'code': 'men'},
                    {'name': 'Women', 'code': 'women'},
                    {'name': 'Unisex', 'code': 'unisex'},
                ]
            },
            {
                'name': 'Material', 'code': 'material', 'is_variant': False,
                'show_in_name': False, 'name_position': 99, 'short_label': None,
                'is_required': False, 'show_by_default': False, 'requires_barcode': False,
                'children': [
                    {'name': 'Cotton', 'code': 'cotton'},
                    {'name': 'Silk', 'code': 'silk'},
                    {'name': 'Leather', 'code': 'leather'},
                    {'name': 'Polyester', 'code': 'polyester'},
                    {'name': 'Glass', 'code': 'glass'},
                    {'name': 'Plastic', 'code': 'plastic'},
                    {'name': 'Metal', 'code': 'metal'},
                ]
            },
            {
                'name': 'Season', 'code': 'season', 'is_variant': False,
                'show_in_name': False, 'name_position': 99, 'short_label': None,
                'is_required': False, 'show_by_default': False, 'requires_barcode': False,
                'children': [
                    {'name': 'Spring/Summer', 'code': 'ss'},
                    {'name': 'Autumn/Winter', 'code': 'aw'},
                    {'name': 'All Season', 'code': 'all_season'},
                    {'name': 'Resort', 'code': 'resort'},
                ]
            },
            {
                'name': 'Volume', 'code': 'volume', 'is_variant': True,
                'show_in_name': True, 'name_position': 0, 'short_label': None,
                'is_required': False, 'show_by_default': True, 'requires_barcode': True,
                'children': [
                    {'name': '30ml', 'code': '30ml'},
                    {'name': '50ml', 'code': '50ml'},
                    {'name': '75ml', 'code': '75ml'},
                    {'name': '100ml', 'code': '100ml'},
                    {'name': '125ml', 'code': '125ml'},
                    {'name': '150ml', 'code': '150ml'},
                    {'name': '200ml', 'code': '200ml'},
                ]
            },
            {
                'name': 'Weight', 'code': 'weight', 'is_variant': False,
                'show_in_name': True, 'name_position': 0, 'short_label': None,
                'is_required': False, 'show_by_default': False, 'requires_barcode': False,
                'children': [
                    {'name': '250g', 'code': '250g'},
                    {'name': '500g', 'code': '500g'},
                    {'name': '1kg', 'code': '1kg'},
                    {'name': '5kg', 'code': '5kg'},
                    {'name': '10kg', 'code': '10kg'},
                    {'name': '25kg', 'code': '25kg'},
                    {'name': '50kg', 'code': '50kg'},
                ]
            },
            {
                'name': 'Flavor', 'code': 'flavor', 'is_variant': False,
                'show_in_name': True, 'name_position': 0, 'short_label': None,
                'is_required': False, 'show_by_default': True, 'requires_barcode': False,
                'children': [
                    {'name': 'Original', 'code': 'original'},
                    {'name': 'Orange', 'code': 'orange'},
                    {'name': 'Apple', 'code': 'apple'},
                    {'name': 'Mango', 'code': 'mango'},
                    {'name': 'Strawberry', 'code': 'strawberry'},
                    {'name': 'Vanilla', 'code': 'vanilla'},
                    {'name': 'Chocolate', 'code': 'chocolate'},
                    {'name': 'Lemon', 'code': 'lemon'},
                ]
            },
        ]

        created_count = 0
        for attr_def in DEFAULTS:
            root, root_created = ProductAttribute.objects.get_or_create(
                organization=org,
                name=attr_def['name'],
                parent=None,
                defaults={
                    'code': attr_def['code'],
                    'is_variant': attr_def.get('is_variant', False),
                    'show_in_name': attr_def.get('show_in_name', False),
                    'name_position': attr_def.get('name_position', 99),
                    'short_label': attr_def.get('short_label'),
                    'is_required': attr_def.get('is_required', False),
                    'show_by_default': attr_def.get('show_by_default', True),
                    'requires_barcode': attr_def.get('requires_barcode', False),
                }
            )
            if root_created:
                created_count += 1

            for idx, child_def in enumerate(attr_def.get('children', [])):
                _, child_created = ProductAttribute.objects.get_or_create(
                    organization=org,
                    parent=root,
                    name=child_def['name'],
                    defaults={
                        'code': child_def['code'],
                        'sort_order': idx,
                        'color_hex': child_def.get('color_hex'),
                    }
                )
                if child_created:
                    created_count += 1

        return Response({
            'status': 'ok',
            'created': created_count,
            'groups': len(DEFAULTS),
        })
