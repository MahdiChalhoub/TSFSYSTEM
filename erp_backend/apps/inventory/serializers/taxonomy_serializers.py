from rest_framework import serializers
from apps.inventory.models import Unit, UnitPackage, Category, Brand, Parfum, Product, ProductGroup
from erp.models import Country

# NOTE: Reverse-related managers (obj.products, obj.brands, etc.) bypass the
# TenantManager and leak cross-organization data. All get_*_count methods
# below explicitly use Product.objects.filter(...) (tenant-scoped) instead
# of obj.products.count() to ensure counts match /explore/ results.


class UnitSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Unit
        fields = [
            'id', 'code', 'name', 'short_name', 'type',
            'conversion_factor', 'base_unit', 'allow_fraction',
            'needs_balance', 'balance_code_structure', 'product_count',
            'organization'
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return Product.objects.filter(unit=obj).count()


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
            'brand_count', 'parfum_count', 'organization'
        ]
        read_only_fields = ['organization', 'level', 'full_path']

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

    class Meta:
        model = UnitPackage
        fields = [
            'id', 'unit', 'unit_name', 'unit_code', 'unit_type',
            'name', 'code', 'ratio', 'is_default', 'order', 'notes',
            'created_at', 'updated_at', 'organization',
        ]
        read_only_fields = ['organization', 'created_at', 'updated_at']
