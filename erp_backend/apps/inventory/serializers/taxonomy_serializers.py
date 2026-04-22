from rest_framework import serializers
from apps.inventory.models import (
    Unit, UnitPackage, PackagingSuggestionRule,
    Category, Brand, Parfum, Product, ProductGroup,
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

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'code', 'short_name', 'parent',
            'level', 'full_path', 'product_count',
            'brand_count', 'parfum_count', 'organization',
            'is_archived', 'archived_at',
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

    def get_product_count(self, obj):
        return Product.objects.filter(category=obj).count()

    def get_brand_count(self, obj):
        return Brand.objects.filter(categories=obj).count()

    def get_parfum_count(self, obj):
        return Parfum.objects.filter(categories=obj).count()


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
    parent_ratio = serializers.DecimalField(max_digits=15, decimal_places=4, allow_null=True, required=False)

    class Meta:
        model = UnitPackage
        fields = [
            'id', 'unit', 'unit_name', 'unit_code', 'unit_type',
            'parent', 'parent_name', 'parent_ratio',
            'name', 'code', 'ratio', 'is_default', 'order', 'notes',
            'created_at', 'updated_at', 'organization',
        ]
        read_only_fields = ['organization', 'created_at', 'updated_at']

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
