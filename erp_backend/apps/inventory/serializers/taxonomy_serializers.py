from rest_framework import serializers
from apps.inventory.models import (
    Unit, UnitPackage, PackagingSuggestionRule,
    Category, Brand, Parfum, Product, ProductGroup, ProductAttribute,
)
from erp.models import Country

# NOTE: Reverse-related managers (obj.products, obj.brands, etc.) bypass the
# TenantManager and leak cross-organization data. All get_*_count methods
# below explicitly use Product.objects.filter(...) (tenant-scoped) instead
# of obj.products.count() to ensure counts match /explore/ results.


class UnitSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    package_count = serializers.SerializerMethodField()

    class Meta:
        model = Unit
        fields = [
            'id', 'code', 'name', 'short_name', 'type',
            'conversion_factor', 'base_unit', 'allow_fraction',
            'needs_balance', 'balance_code_structure', 'product_count',
            'package_count', 'organization'
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return Product.objects.filter(unit=obj).count()

    def get_package_count(self, obj):
        return UnitPackage.objects.filter(unit=obj).count()


class CountrySimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'code', 'name']


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    brand_count = serializers.SerializerMethodField()
    parfum_count = serializers.SerializerMethodField()
    attribute_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'code', 'short_name', 'parent',
            'level', 'full_path', 'product_count',
            'brand_count', 'parfum_count', 'attribute_count', 'organization',
            'is_archived', 'archived_at',
            'barcode_prefix',
        ]
        read_only_fields = ['organization', 'level', 'full_path', 'archived_at']

    def validate_name(self, value):
        """Pre-flight duplicate check so the DB UNIQUE constraint doesn't
        bubble up as a 500. DRF turns ValidationError into 400 with a clean
        field-level message the frontend can render."""
        from erp.middleware import get_current_tenant_id
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return value
        qs = Category.original_objects.filter(name__iexact=value, organization_id=tenant_id)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f'A category named "{value}" already exists. Pick a different name or edit the existing one.'
            )
        return value

    def validate_barcode_prefix(self, value):
        """Barcode prefixes must be unique per tenant (non-empty only).
        Two categories sharing a prefix would collide on auto-generated
        product barcodes. Empty string is allowed and means "no prefix"."""
        if not value:
            return value
        from erp.middleware import get_current_tenant_id
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return value
        qs = Category.original_objects.filter(
            barcode_prefix=value, organization_id=tenant_id,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            owner = qs.first().name
            raise serializers.ValidationError(
                f'Prefix "{value}" is already used by category "{owner}". '
                f'Each category needs its own unique prefix — otherwise barcodes collide.'
            )
        return value

    def get_product_count(self, obj):
        pre = (self.context or {}).get('product_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        return Product.objects.filter(category=obj).count()

    # ── Union counts (auto-linked via products + explicit M2M) ────────────
    # `linked_brands` / `linked_attributes` / `with_counts` all compute the
    # union of "products in this category reference this brand/attribute"
    # (auto) and "category was explicitly pre-registered with this
    # brand/attribute" (explicit M2M). Every Category serialisation must
    # report the same number, otherwise row badges and detail-tab counts
    # diverge. The single source of truth lives here.
    #
    # When serializing many categories at once, pass
    # `context={'brand_counts':..., 'parfum_counts':..., 'attribute_counts':..., 'product_counts':...}`
    # to avoid N+1 (see `CategorySerializer.prefetch_counts`).

    def get_brand_count(self, obj):
        pre = (self.context or {}).get('brand_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        auto = set(
            Product.objects.filter(category=obj, brand__isnull=False)
                .values_list('brand_id', flat=True).distinct()
        )
        explicit = set(
            Brand.categories.through.objects
                .filter(category_id=obj.id)
                .values_list('brand_id', flat=True)
        )
        return len(auto | explicit)

    def get_parfum_count(self, obj):
        pre = (self.context or {}).get('parfum_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        auto = set(
            Product.objects.filter(category=obj, parfum__isnull=False)
                .values_list('parfum_id', flat=True).distinct()
        )
        explicit = set(
            Parfum.categories.through.objects
                .filter(category_id=obj.id)
                .values_list('parfum_id', flat=True)
        )
        return len(auto | explicit)

    def get_attribute_count(self, obj):
        pre = (self.context or {}).get('attribute_counts')
        if pre is not None:
            return pre.get(obj.id, 0)
        # Auto-derived: attribute groups whose leaf values are referenced
        # by a product in this category (leaf.parent → group).
        auto = set(
            Product.attribute_values.through.objects
                .filter(
                    product__category_id=obj.id,
                    productattribute__parent_id__isnull=False,
                )
                .values_list('productattribute__parent_id', flat=True)
        )
        # Explicit: category.attributes M2M (pre-registration, root groups only).
        explicit = set(
            ProductAttribute.categories.through.objects
                .filter(
                    category_id=obj.id,
                    productattribute__parent__isnull=True,
                )
                .values_list('productattribute_id', flat=True)
        )
        return len(auto | explicit)

    @classmethod
    def prefetch_counts(cls, organization):
        """Bulk-compute product/brand/parfum/attribute counts for every
        category in one tenant. Returns a context dict to pass to the
        serializer — eliminates N+1 when rendering many categories.

        Union = products-in-category (auto) ∪ pre-registered M2M (explicit).
        """
        product_counts: dict[int, int] = {}
        auto_brands: dict[int, set[int]] = {}
        auto_parfums: dict[int, set[int]] = {}
        auto_attrs: dict[int, set[int]] = {}

        # Products in this tenant grouped by category
        for p in Product.objects.filter(
            organization=organization, category__isnull=False
        ).values('category_id', 'brand_id', 'parfum_id'):
            cid = p['category_id']
            product_counts[cid] = product_counts.get(cid, 0) + 1
            if p['brand_id']:
                auto_brands.setdefault(cid, set()).add(p['brand_id'])
            if p['parfum_id']:
                auto_parfums.setdefault(cid, set()).add(p['parfum_id'])

        # Auto attributes: one pass over the product↔attribute_values through
        # table, grouped on the leaf's parent (the attribute group).
        for cid, gid in Product.attribute_values.through.objects.filter(
            product__organization=organization,
            product__category__isnull=False,
            productattribute__parent_id__isnull=False,
        ).values_list('product__category_id', 'productattribute__parent_id'):
            if gid is not None:
                auto_attrs.setdefault(cid, set()).add(gid)

        # Explicit M2M links per category
        explicit_brands: dict[int, set[int]] = {}
        for bid, cid in Brand.categories.through.objects.filter(
            category__organization=organization,
        ).values_list('brand_id', 'category_id'):
            explicit_brands.setdefault(cid, set()).add(bid)

        explicit_parfums: dict[int, set[int]] = {}
        for pid, cid in Parfum.categories.through.objects.filter(
            category__organization=organization,
        ).values_list('parfum_id', 'category_id'):
            explicit_parfums.setdefault(cid, set()).add(pid)

        explicit_attrs: dict[int, set[int]] = {}
        for aid, cid in ProductAttribute.categories.through.objects.filter(
            productattribute__organization=organization,
            productattribute__parent__isnull=True,
        ).values_list('productattribute_id', 'category_id'):
            explicit_attrs.setdefault(cid, set()).add(aid)

        brand_counts = {
            cid: len(auto_brands.get(cid, set()) | explicit_brands.get(cid, set()))
            for cid in set(auto_brands) | set(explicit_brands)
        }
        parfum_counts = {
            cid: len(auto_parfums.get(cid, set()) | explicit_parfums.get(cid, set()))
            for cid in set(auto_parfums) | set(explicit_parfums)
        }
        attribute_counts = {
            cid: len(auto_attrs.get(cid, set()) | explicit_attrs.get(cid, set()))
            for cid in set(auto_attrs) | set(explicit_attrs)
        }

        return {
            'product_counts': product_counts,
            'brand_counts': brand_counts,
            'parfum_counts': parfum_counts,
            'attribute_counts': attribute_counts,
        }


class CategorySimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'code']


class StorefrontCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'code', 'short_name', 'full_path', 'level', 'products_count']


class BrandSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    countries = CountrySimpleSerializer(many=True, read_only=True)
    categories = CategorySimpleSerializer(many=True, read_only=True)
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), many=True, write_only=True, source='categories', required=False
    )
    country_ids = serializers.PrimaryKeyRelatedField(
        queryset=Country.objects.all(), many=True, write_only=True, source='countries', required=False
    )

    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'short_name', 'logo',
            'countries', 'categories',
            'category_ids', 'country_ids',
            'product_count',
            'created_at', 'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return Product.objects.filter(brand=obj).count()


class BrandDetailSerializer(serializers.ModelSerializer):
    countries = CountrySimpleSerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'short_name', 'logo',
            'countries', 'categories',
            'product_count', 'created_at', 'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return Product.objects.filter(brand=obj).count()


class StorefrontBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'name', 'short_name', 'logo']


class ParfumSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    categories = CategorySimpleSerializer(many=True, read_only=True)
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), many=True, write_only=True, source='categories', required=False
    )

    class Meta:
        model = Parfum
        fields = [
            'id', 'name', 'short_name',
            'categories', 'category_ids',
            'product_count',
            'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return Product.objects.filter(parfum=obj).count()


class ProductGroupSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    parfum_name = serializers.CharField(source='parfum.name', read_only=True, default=None)
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = ProductGroup
        fields = [
            'id', 'name', 'description', 'image',
            'brand', 'parfum', 'category',
            'brand_name', 'parfum_name', 'category_name',
            'product_count', 'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return Product.objects.filter(product_group=obj).count()


class UnitPackageSerializer(serializers.ModelSerializer):
    unit_name = serializers.ReadOnlyField(source='unit.name')
    unit_code = serializers.ReadOnlyField(source='unit.code')
    unit_type = serializers.ReadOnlyField(source='unit.type')

    parent_name = serializers.ReadOnlyField(source='parent.name', default=None)
    parent_ratio = serializers.DecimalField(
        max_digits=15, decimal_places=4, allow_null=True, required=False,
    )

    class Meta:
        model = UnitPackage
        fields = [
            'id', 'unit', 'unit_name', 'unit_code', 'unit_type',
            'parent', 'parent_name', 'parent_ratio',
            'name', 'code', 'ratio', 'is_default', 'order', 'notes',
            'is_archived', 'archived_at',
            'created_at', 'updated_at', 'organization',
        ]
        read_only_fields = ['organization', 'created_at', 'updated_at', 'archived_at']

    def validate(self, attrs):
        """Chain integrity: tenant scope, same-unit, cycle detection,
        parent_ratio sanity, and server-derived `ratio` when chained.

        Object-level validation because `parent` must be cross-checked
        against `unit` and `ratio` is recomputed from the chain.
        """
        from erp.middleware import get_current_tenant_id
        from decimal import Decimal

        instance = self.instance
        unit = attrs.get('unit') or (instance.unit if instance else None)
        parent = attrs.get('parent') if 'parent' in attrs else (instance.parent if instance else None)
        parent_ratio = attrs.get('parent_ratio') if 'parent_ratio' in attrs else (instance.parent_ratio if instance else None)

        if parent is not None:
            tenant_id = get_current_tenant_id()
            if tenant_id and parent.organization_id != tenant_id:
                raise serializers.ValidationError({
                    'parent': 'Parent template belongs to a different organization.'
                })
            if unit and parent.unit_id != unit.id:
                raise serializers.ValidationError({
                    'parent': (
                        f'Parent template "{parent.name}" uses a different unit '
                        f'({parent.unit.code}) — chains must stay within one unit family.'
                    )
                })
            # Cycle detection — walk up from parent
            seen = set()
            cursor = parent
            while cursor is not None:
                if instance and cursor.id == instance.id:
                    raise serializers.ValidationError({
                        'parent': 'Cycle detected — a template cannot be its own ancestor.'
                    })
                if cursor.id in seen:
                    raise serializers.ValidationError({
                        'parent': 'Existing chain already contains a cycle — repair required.'
                    })
                seen.add(cursor.id)
                cursor = cursor.parent
            if parent_ratio is None or Decimal(str(parent_ratio)) <= 0:
                raise serializers.ValidationError({
                    'parent_ratio': 'When a parent is set, parent_ratio is required and must be > 0.'
                })
            # Derive `ratio` server-side — ignore any client value for consistency
            attrs['ratio'] = (Decimal(str(parent.ratio)) * Decimal(str(parent_ratio))).quantize(Decimal('0.0001'))
        else:
            # Base-level template — clear parent_ratio to avoid orphan data
            attrs['parent_ratio'] = None

        return attrs


class PackagingSuggestionRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    brand_name = serializers.ReadOnlyField(source='brand.name')
    attribute_name = serializers.ReadOnlyField(source='attribute.name')
    packaging_name = serializers.ReadOnlyField(source='packaging.name')
    packaging_ratio = serializers.ReadOnlyField(source='packaging.ratio')
    packaging_unit_code = serializers.ReadOnlyField(source='packaging.unit.code')
    specificity = serializers.ReadOnlyField()
    effective_priority = serializers.SerializerMethodField()

    class Meta:
        model = PackagingSuggestionRule
        fields = [
            'id', 'category', 'category_name', 'brand', 'brand_name',
            'attribute', 'attribute_name', 'attribute_value',
            'packaging', 'packaging_name', 'packaging_ratio', 'packaging_unit_code',
            'priority', 'effective_priority', 'specificity',
            'usage_count', 'notes',
            'created_at', 'updated_at', 'organization',
        ]
        read_only_fields = ['organization', 'usage_count', 'created_at', 'updated_at']

    def get_effective_priority(self, obj):
        return obj.effective_priority()
