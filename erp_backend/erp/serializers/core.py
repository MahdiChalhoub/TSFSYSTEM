"""
Kernel Core Serializers
Contains ONLY kernel-level serializers (Organization, Site, User, Role, etc.)
Business serializers have been migrated to their respective modules.
"""
from rest_framework import serializers
from erp.models import (
    Organization, Site, User, Role, Country,
    SystemModule, OrganizationModule, SystemUpdate,
    BusinessType, GlobalCurrency, Notification
)


class OrganizationSerializer(serializers.ModelSerializer):
    site_count = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()
    module_count = serializers.SerializerMethodField()
    current_plan_name = serializers.SerializerMethodField()
    business_type_name = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()
    currency_code = serializers.SerializerMethodField()
    currency_symbol = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'is_active', 'created_at', 'updated_at',
            'logo', 'business_email', 'phone', 'website',
            'address', 'city', 'state', 'zip_code', 'country', 'timezone',
            'business_type', 'base_currency', 'settings',
            'site_count', 'user_count', 'module_count',
            'current_plan_name', 'business_type_name', 'client_name',
            'currency_code', 'currency_symbol',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'site_count', 'user_count', 'module_count',
                            'current_plan_name', 'business_type_name', 'client_name',
                            'currency_code', 'currency_symbol']

    def get_site_count(self, obj):
        return Site.original_objects.filter(organization=obj).count()

    def get_user_count(self, obj):
        return User.objects.filter(organization=obj).count()

    def get_module_count(self, obj):
        # Count explicitly enabled modules for this org
        count = OrganizationModule.objects.filter(organization=obj, is_enabled=True).count()
        if count == 0:
            # Fallback: count all installed SystemModules (global)
            count = SystemModule.objects.filter(status='INSTALLED').count()
        return count

    def get_current_plan_name(self, obj):
        return obj.current_plan.name if obj.current_plan else 'Free Tier'

    def get_business_type_name(self, obj):
        return obj.business_type.name if obj.business_type else None

    def get_client_name(self, obj):
        return str(obj.client) if obj.client else None

    def get_currency_code(self, obj):
        return obj.base_currency.code if obj.base_currency else 'USD'

    def get_currency_symbol(self, obj):
        return obj.base_currency.symbol if obj.base_currency else '$'


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
    has_official_pin = serializers.SerializerMethodField()
    has_internal_pin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'organization', 'role',
                  'is_staff', 'is_superuser', 'has_official_pin', 'has_internal_pin']

    def get_has_official_pin(self, obj):
        return bool(obj.scope_pin_official)

    def get_has_internal_pin(self, obj):
        return bool(obj.scope_pin_internal)


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
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


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'type', 'link', 'read_at', 'created_at']
        read_only_fields = ['id', 'created_at']


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
