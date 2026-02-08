"""
Kernel Core Serializers
Contains ONLY kernel-level serializers (Organization, Site, User, Role, etc.)
Business serializers have been migrated to their respective modules.
"""
from rest_framework import serializers
from erp.models import (
    Organization, Site, User, Role, Country,
    SystemModule, OrganizationModule, SystemUpdate,
    BusinessType, GlobalCurrency
)


class OrganizationSerializer(serializers.ModelSerializer):
    site_count = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()
    module_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'is_active', 'created_at', 'updated_at',
            'logo', 'business_email', 'phone', 'website',
            'address', 'city', 'state', 'zip_code', 'country', 'timezone',
            'business_type', 'base_currency', 'settings',
            'site_count', 'user_count', 'module_count',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'site_count', 'user_count', 'module_count']

    def get_site_count(self, obj):
        return obj.sites.count() if hasattr(obj, 'sites') else 0

    def get_user_count(self, obj):
        return User.objects.filter(organization=obj).count()

    def get_module_count(self, obj):
        return OrganizationModule.objects.filter(organization=obj, is_enabled=True).count()


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = '__all__'


class BusinessTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessType
        fields = '__all__'


class GlobalCurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalCurrency
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'organization', 'role', 'is_staff', 'is_superuser']


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'


class SystemModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemModule
        fields = '__all__'


class SaaSModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemModule
        fields = '__all__'


class OrganizationModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationModule
        fields = '__all__'


class SystemUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemUpdate
        fields = '__all__'


# =============================================================================
# BACKWARD-COMPATIBLE RE-EXPORTS
# Each is gated — kernel boots even if a module is removed.
# =============================================================================
try:
    from apps.finance.serializers import (  # noqa: E402, F401
        ChartOfAccountSerializer, FinancialAccountSerializer,
        FiscalYearSerializer, FiscalPeriodSerializer,
        JournalEntrySerializer, JournalEntryLineSerializer,
        TransactionSerializer, TransactionSequenceSerializer,
        BarcodeSettingsSerializer, LoanSerializer, LoanInstallmentSerializer,
        FinancialEventSerializer
    )
except ImportError:
    pass

try:
    from apps.inventory.serializers import (  # noqa: E402, F401
        ProductSerializer, ProductCreateSerializer, UnitSerializer,
        CategorySerializer, BrandSerializer, BrandDetailSerializer,
        ParfumSerializer, ProductGroupSerializer,
        WarehouseSerializer, InventorySerializer, InventoryMovementSerializer
    )
except ImportError:
    pass

try:
    from apps.pos.serializers import OrderSerializer, OrderLineSerializer  # noqa: E402, F401
except ImportError:
    pass

try:
    from apps.crm.serializers import ContactSerializer  # noqa: E402, F401
except ImportError:
    pass

try:
    from apps.hr.serializers import EmployeeSerializer  # noqa: E402, F401
except ImportError:
    pass
