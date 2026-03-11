from rest_framework import serializers
from apps.inventory.models import Unit, Category, Brand, Parfum, ProductGroup
from erp.models import Country

class UnitSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Unit
        fields = [
            'id', 'code', 'name', 'short_name', 'type', 
            'conversion_factor', 'base_unit', 'allow_fraction', 
            'needs_balance', 'balance_code_structure', 'product_count',
            'tenant'
        ]
        read_only_fields = ['tenant']

    def get_product_count(self, obj):
        return obj.products.count()


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
            'brand_count', 'parfum_count', 'tenant'
        ]
        read_only_fields = ['tenant', 'level', 'full_path']

    def get_product_count(self, obj):
        return obj.products.count()

    def get_brand_count(self, obj):
        return obj.brands.count()

    def get_parfum_count(self, obj):
        return obj.parfums.count()


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
            'created_at', 'tenant',
        ]
        read_only_fields = ['tenant']

    def get_product_count(self, obj):
        return obj.products.count()


class BrandDetailSerializer(serializers.ModelSerializer):
    countries = CountrySimpleSerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'short_name', 'logo',
            'countries', 'categories',
            'product_count', 'created_at', 'tenant',
        ]
        read_only_fields = ['tenant']

    def get_product_count(self, obj):
        return obj.products.count()


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
            'tenant',
        ]
        read_only_fields = ['tenant']

    def get_product_count(self, obj):
        return obj.products.count()


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
            'product_count', 'tenant',
        ]
        read_only_fields = ['tenant']

    def get_product_count(self, obj):
        return obj.products.count()
