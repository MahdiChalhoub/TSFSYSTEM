from rest_framework import serializers
from .models import (
    Organization, Site, 
    Product, Warehouse, Inventory, InventoryMovement, Unit,
    Brand, Category, Parfum, ProductGroup, Country,
    Contact, Employee, Role, TransactionSequence, BarcodeSettings, User,
    PlanCategory, SubscriptionPlan, SubscriptionPayment
)
from apps.finance.serializers import (
    FinancialAccountSerializer, FiscalPeriodSerializer, FiscalYearSerializer,
    ChartOfAccountSerializer, JournalEntryLineSerializer, JournalEntrySerializer,
    LoanInstallmentSerializer, LoanSerializer, FinancialEventSerializer,
    TransactionSerializer
)

class OrganizationSerializer(serializers.ModelSerializer):
    _count = serializers.SerializerMethodField()

    def get__count(self, obj):
        return {
            "sites": obj.site_set.count() if hasattr(obj, 'site_set') else 0,
            "users": obj.users.count() if hasattr(obj, 'users') else 0
        }

    class Meta:
        model = Organization
        fields = '__all__'


class BrandSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    def get_product_count(self, obj):
        return obj.product_set.count()

    class Meta:
        model = Brand
        fields = '__all__'

class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    
    def get_product_count(self, obj):
        return obj.products.count() if hasattr(obj, 'products') else obj.product_set.count()

    def get_children(self, obj):
        children = Category.objects.filter(parent=obj)
        return CategorySerializer(children, many=True).data

    class Meta:
        model = Category
        fields = '__all__'

class ParfumSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    def get_product_count(self, obj):
        return obj.product_set.count()

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['categories'] = CategorySerializer(instance.categories.all(), many=True).data
        return ret

    class Meta:
        model = Parfum
        fields = '__all__'
        extra_kwargs = {
            'categories': {'required': False}
        }


class CountrySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    def get_product_count(self, obj):
        return getattr(obj, 'product_set', []).count() if hasattr(obj, 'product_set') else 0

    class Meta:
        model = Country
        fields = '__all__'


class ProductCreateSerializer(serializers.Serializer):
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

class SimpleSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ('id', 'name', 'code')

class WarehouseSerializer(serializers.ModelSerializer):
    site = SimpleSiteSerializer(read_only=True)
    inventory_count = serializers.SerializerMethodField()

    def get_inventory_count(self, obj):
        return obj.inventory.count()

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
    warehouses = WarehouseSerializer(many=True, read_only=True)

    class Meta:
        model = Site
        fields = '__all__'

from .serializers_shared import UserValueSerializer

class UnitSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    def get_product_count(self, obj):
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
        read_only_fields = ('organization',)

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
        read_only_fields = ('organization',)

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

class EmployeeSerializer(serializers.ModelSerializer):
    home_site = SiteSerializer(read_only=True)
    linked_account = FinancialAccountSerializer(read_only=True)
    user_email = serializers.ReadOnlyField(source='user.email')
    user_id = serializers.ReadOnlyField(source='user.id')

    class Meta:
        model = Employee
        fields = '__all__'
        read_only_fields = ('organization',)

class BrandDetailSerializer(serializers.ModelSerializer):
    countries = CountrySerializer(many=True, read_only=True)
    productGroups = ProductGroupSerializer(source='productgroup_set', many=True, read_only=True)
    products = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = '__all__'

    def get_products(self, obj):
        standalone = obj.product_set.filter(product_group__isnull=True)
        return ProductSerializer(standalone, many=True).data

class TransactionSequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionSequence
        fields = '__all__'

class BarcodeSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BarcodeSettings
        fields = '__all__'

# --- Subscription Serializers ---

class PlanCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanCategory
        fields = '__all__'

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    category = PlanCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(queryset=PlanCategory.objects.all(), source='category', write_only=True)
    
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'

class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source='plan.name')
    
    class Meta:
        model = SubscriptionPayment
        fields = '__all__'
