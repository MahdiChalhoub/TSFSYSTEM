from rest_framework import serializers
from .models import (
    Organization, Site, FinancialAccount, FiscalYear, 
    FiscalPeriod, JournalEntry, JournalEntryLine, ChartOfAccount,
    Product, Warehouse, Inventory, InventoryMovement, Unit,
    Brand, Category, Parfum, ProductGroup, Country,
    Contact, Employee, Role
)

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = '__all__'

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ParfumSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parfum
        fields = '__all__'


class CountrySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    def get_product_count(self, obj):
        return getattr(obj, 'product_set', []).count() if hasattr(obj, 'product_set') else 0

    class Meta:
        model = Country
        fields = '__all__'


class ProductCreateSerializer(serializers.Serializer):
    """
    Serializer to handle complex product creation with auto-grouping.
    """
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    sku = serializers.CharField(max_length=100)
    barcode = serializers.CharField(required=False, allow_blank=True)
    
    categoryId = serializers.IntegerField(required=False, allow_null=True)
    unitId = serializers.IntegerField(required=False, allow_null=True)
    brandId = serializers.IntegerField(required=False, allow_null=True)
    countryId = serializers.IntegerField(required=False, allow_null=True)
    
    parfumName = serializers.CharField(required=False, allow_blank=True)
    
    costPrice = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    sellingPriceHT = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    sellingPriceTTC = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    
    taxRate = serializers.DecimalField(max_digits=5, decimal_places=4, required=False)
    isTaxIncluded = serializers.BooleanField(default=False)
    minStockLevel = serializers.IntegerField(default=10)
    isExpiryTracked = serializers.BooleanField(default=False)

class WarehouseSerializer(serializers.ModelSerializer):
    site_name = serializers.ReadOnlyField(source='site.name')
    inventory_count = serializers.SerializerMethodField()

    def get_inventory_count(self, obj):
        return obj.inventory_set.count()

    class Meta:
        model = Warehouse
        fields = '__all__'

class InventorySerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')

    class Meta:
        model = Inventory
        fields = '__all__'

class InventoryMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryMovement
        fields = '__all__'

class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = '__all__'

class FinancialAccountSerializer(serializers.ModelSerializer):
    site_name = serializers.ReadOnlyField(source='site.name')
    ledger_code = serializers.ReadOnlyField(source='ledger_account.code')

    class Meta:
        model = FinancialAccount
        fields = '__all__'
        read_only_fields = ('ledger_account',)

class FiscalYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalYear
        fields = '__all__'

class FiscalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalPeriod
        fields = '__all__'

class ChartOfAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChartOfAccount
        fields = '__all__'

class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.name')
    account_code = serializers.ReadOnlyField(source='account.code')

    class Meta:
        model = JournalEntryLine
        fields = '__all__'

class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    site_name = serializers.ReadOnlyField(source='site.name')

    class Meta:
        model = JournalEntry
        fields = '__all__'

class UnitSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    def get_product_count(self, obj):
        # Handle 'product_set' reverse relation
        return getattr(obj, 'product_set', []).count() if hasattr(obj, 'product_set') else 0

    class Meta:
        model = Unit
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    brand = BrandSerializer(read_only=True)
    unit = UnitSerializer(read_only=True)
    country = CountrySerializer(read_only=True)
    inventory = InventorySerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = '__all__'

class ProductGroupSerializer(serializers.ModelSerializer):
    brand = BrandSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    products = ProductSerializer(source='product_set', many=True, read_only=True)

    class Meta:
        model = ProductGroup
        fields = '__all__'

class ContactSerializer(serializers.ModelSerializer):
    home_site = SiteSerializer(read_only=True)
    linked_account = FinancialAccountSerializer(read_only=True)

    class Meta:
        model = Contact
        fields = '__all__'

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

class EmployeeSerializer(serializers.ModelSerializer):
    home_site = SiteSerializer(read_only=True)
    linked_account = FinancialAccountSerializer(read_only=True)
    # Basic user info
    user_email = serializers.ReadOnlyField(source='user.email')
    user_id = serializers.ReadOnlyField(source='user.id')

    class Meta:
        model = Employee
        fields = '__all__'

class BrandDetailSerializer(serializers.ModelSerializer):
    countries = CountrySerializer(many=True, read_only=True)
    productGroups = ProductGroupSerializer(source='product_set', many=True, read_only=True) # Wait, product_set? NO! productgroup_set!
    # I need to be careful about related_name. If not set, it is modelname_set.
    # ProductGroup -> productgroup_set.
    # Brand -> products (Product) -> product_set.
    # Brand -> productGroups (ProductGroup) -> productgroup_set.
    # Frontend props: productGroups, products.
    # Serializer fields: productGroups (mapped to productgroup_set), products (method field for filtered).
    
    productGroups = ProductGroupSerializer(source='productgroup_set', many=True, read_only=True)
    products = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = '__all__'

    def get_products(self, obj):
        # Standalone products (no group)
        standalone = obj.product_set.filter(product_group__isnull=True)
        return ProductSerializer(standalone, many=True).data

