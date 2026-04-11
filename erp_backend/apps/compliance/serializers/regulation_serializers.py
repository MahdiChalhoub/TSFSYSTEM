"""
Compliance Serializers
======================
REST serializers for PriceRegulation, RegulationRule, and RegulationAuditLog.
"""
from rest_framework import serializers
from apps.compliance.models import PriceRegulation, RegulationRule, RegulationAuditLog


class PriceRegulationSerializer(serializers.ModelSerializer):
    """Full serializer for PriceRegulation CRUD."""
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    jurisdiction_country_name = serializers.CharField(
        source='jurisdiction_country.name', read_only=True, default=''
    )
    rules_count = serializers.SerializerMethodField()
    products_count = serializers.SerializerMethodField()
    violations_count = serializers.SerializerMethodField()

    class Meta:
        model = PriceRegulation
        fields = [
            'id', 'name', 'code', 'description',
            'regulation_type', 'fixed_price', 'max_price', 'min_price',
            'currency', 'currency_code', 'tolerance',
            'scope', 'severity',
            'allow_override', 'override_requires_approval', 'auto_correct',
            'reference', 'authority', 'effective_date', 'expiry_date',
            'jurisdiction_country', 'jurisdiction_country_name', 'jurisdiction_region',
            'version', 'is_current', 'previous_version',
            'status', 'notes',
            'rules_count', 'products_count', 'violations_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['version', 'is_current', 'previous_version', 'created_at', 'updated_at']

    def get_rules_count(self, obj):
        return obj.rules.count()

    def get_products_count(self, obj):
        return obj.products.count()

    def get_violations_count(self, obj):
        return obj.products.filter(regulation_status='VIOLATION').count()


class PriceRegulationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    jurisdiction_country_name = serializers.CharField(
        source='jurisdiction_country.name', read_only=True, default=''
    )
    jurisdiction_country_iso2 = serializers.CharField(
        source='jurisdiction_country.iso2', read_only=True, default=''
    )
    rules_count = serializers.SerializerMethodField()
    products_count = serializers.SerializerMethodField()
    violations_count = serializers.SerializerMethodField()

    class Meta:
        model = PriceRegulation
        fields = [
            'id', 'name', 'code', 'regulation_type',
            'fixed_price', 'max_price', 'min_price',
            'currency_code', 'tolerance',
            'scope', 'severity', 'auto_correct',
            'reference', 'authority', 'effective_date', 'expiry_date',
            'jurisdiction_country', 'jurisdiction_country_name',
            'jurisdiction_country_iso2', 'jurisdiction_region',
            'version', 'is_current', 'status',
            'rules_count', 'products_count', 'violations_count',
            'created_at',
        ]

    def get_rules_count(self, obj):
        return obj.rules.count()

    def get_products_count(self, obj):
        return obj.products.count()

    def get_violations_count(self, obj):
        return obj.products.filter(regulation_status='VIOLATION').count()


class RegulationRuleSerializer(serializers.ModelSerializer):
    """Full serializer for RegulationRule CRUD."""
    category_name = serializers.CharField(source='category.name', read_only=True, default='')
    product_country_name = serializers.CharField(
        source='product_country.name', read_only=True, default=''
    )
    unit_code = serializers.CharField(source='unit.code', read_only=True, default='')
    parfum_name = serializers.CharField(source='parfum.name', read_only=True, default='')
    brand_names = serializers.SerializerMethodField()
    regulation_code = serializers.CharField(source='regulation.code', read_only=True)
    regulation_name = serializers.CharField(source='regulation.name', read_only=True)

    class Meta:
        model = RegulationRule
        fields = [
            'id', 'regulation', 'regulation_code', 'regulation_name',
            'category', 'category_name',
            'product_country', 'product_country_name',
            'brands', 'brand_names',
            'unit', 'unit_code',
            'parfum', 'parfum_name',
            'size_exact', 'size_min', 'size_max',
            'auto_create_group', 'price_group',
            'priority', 'is_active',
            'created_at', 'updated_at',
        ]

    def get_brand_names(self, obj):
        return list(obj.brands.values_list('name', flat=True))


class RegulationAuditLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for audit log entries."""
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True, default='')
    currency_code = serializers.CharField(source='currency.code', read_only=True, default='')

    class Meta:
        model = RegulationAuditLog
        fields = [
            'id', 'action', 'action_display',
            'user', 'username',
            'product', 'product_sku', 'product_name',
            'regulation', 'regulation_code', 'regulation_version',
            'old_price', 'new_price', 'regulated_price', 'violation_amount',
            'currency', 'currency_code',
            'source', 'source_display', 'scope',
            'override_reason', 'details',
            'timestamp',
        ]
        read_only_fields = fields  # Entire model is read-only


class ComplianceSummarySerializer(serializers.Serializer):
    """Summary metrics for the compliance dashboard."""
    total_regulations = serializers.IntegerField()
    active_regulations = serializers.IntegerField()
    total_regulated_products = serializers.IntegerField()
    compliant_products = serializers.IntegerField()
    violating_products = serializers.IntegerField()
    compliance_rate = serializers.FloatField()
    expiring_soon = serializers.IntegerField()
