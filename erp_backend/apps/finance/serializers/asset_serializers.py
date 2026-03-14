"""
Asset Serializers
=================
Enhanced serializers for asset management and depreciation tracking.
"""

from rest_framework import serializers
from apps.finance.models import Asset, AmortizationSchedule


class AmortizationScheduleSerializer(serializers.ModelSerializer):
    """Serializer for depreciation schedule entries."""

    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    journal_entry_number = serializers.CharField(
        source='journal_entry.entry_number',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = AmortizationSchedule
        fields = [
            'id', 'organization', 'asset',
            'period_date', 'amount',
            'is_posted', 'journal_entry', 'journal_entry_number',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'journal_entry_number']


class AssetSerializer(serializers.ModelSerializer):
    """Enhanced serializer for assets with depreciation details."""

    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    # Account names (read-only)
    asset_account_name = serializers.CharField(
        source='asset_coa.name',
        read_only=True,
        allow_null=True
    )
    depreciation_expense_account_name = serializers.CharField(
        source='depreciation_expense_coa.name',
        read_only=True,
        allow_null=True
    )
    accumulated_depreciation_account_name = serializers.CharField(
        source='accumulated_depreciation_coa.name',
        read_only=True,
        allow_null=True
    )

    # Computed fields
    depreciable_amount = serializers.SerializerMethodField()
    depreciation_progress = serializers.SerializerMethodField()
    remaining_to_depreciate = serializers.SerializerMethodField()
    monthly_depreciation = serializers.SerializerMethodField()

    # Include schedule
    amortization_lines = AmortizationScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = Asset
        fields = [
            'id', 'organization', 'name', 'description', 'category',
            'purchase_value', 'purchase_date', 'residual_value',
            'useful_life_years', 'depreciation_method',
            'accumulated_depreciation', 'book_value',
            'asset_coa', 'asset_account_name',
            'depreciation_expense_coa', 'depreciation_expense_account_name',
            'accumulated_depreciation_coa', 'accumulated_depreciation_account_name',
            'source_account', 'scope', 'status',
            'depreciable_amount', 'depreciation_progress',
            'remaining_to_depreciate', 'monthly_depreciation',
            'amortization_lines',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'organization', 'accumulated_depreciation', 'book_value',
            'created_at', 'updated_at',
            'asset_account_name', 'depreciation_expense_account_name',
            'accumulated_depreciation_account_name',
            'depreciable_amount', 'depreciation_progress',
            'remaining_to_depreciate', 'monthly_depreciation'
        ]

    def get_depreciable_amount(self, obj):
        """Calculate depreciable amount."""
        return obj.purchase_value - obj.residual_value

    def get_depreciation_progress(self, obj):
        """Calculate depreciation progress percentage."""
        depreciable = obj.purchase_value - obj.residual_value
        if depreciable <= 0:
            return 100
        return round((float(obj.accumulated_depreciation) / float(depreciable)) * 100, 1)

    def get_remaining_to_depreciate(self, obj):
        """Calculate remaining amount to depreciate."""
        depreciable = obj.purchase_value - obj.residual_value
        return depreciable - obj.accumulated_depreciation

    def get_monthly_depreciation(self, obj):
        """Calculate monthly depreciation amount."""
        from apps.finance.services.depreciation_service import DepreciationService
        service = DepreciationService(obj)
        return service.calculate_monthly_depreciation()


class AssetCreateSerializer(serializers.Serializer):
    """Serializer for creating new assets."""

    name = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.ChoiceField(
        choices=Asset.CATEGORIES,
        default='OTHER'
    )
    purchase_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    purchase_date = serializers.DateField()
    useful_life_years = serializers.IntegerField(min_value=1, default=5)
    residual_value = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0.00
    )
    depreciation_method = serializers.ChoiceField(
        choices=Asset.DEPRECIATION_METHODS,
        default='LINEAR'
    )
    asset_coa_id = serializers.IntegerField(help_text='Asset account (COA)')
    depreciation_expense_coa_id = serializers.IntegerField(
        help_text='Depreciation expense account (COA)'
    )
    accumulated_depreciation_coa_id = serializers.IntegerField(
        help_text='Accumulated depreciation account (COA)'
    )
    source_account_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='Bank/cash account used for purchase'
    )
    scope = serializers.ChoiceField(
        choices=['OFFICIAL', 'SANDBOX'],
        default='OFFICIAL'
    )


class DepreciationPostingSerializer(serializers.Serializer):
    """Serializer for depreciation posting request."""

    month = serializers.IntegerField(min_value=1, max_value=12)
    year = serializers.IntegerField(min_value=2000, max_value=2100)


class AssetDisposalSerializer(serializers.Serializer):
    """Serializer for asset disposal."""

    disposal_date = serializers.DateField()
    disposal_amount = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text='Sale/disposal proceeds'
    )
    disposal_account_id = serializers.IntegerField(
        help_text='Bank/cash account receiving proceeds'
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text='Disposal notes'
    )


class DepreciationSummarySerializer(serializers.Serializer):
    """Serializer for depreciation summary output."""

    asset_id = serializers.IntegerField()
    asset_name = serializers.CharField()
    purchase_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    residual_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    depreciable_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    accumulated_depreciation = serializers.DecimalField(max_digits=15, decimal_places=2)
    book_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    remaining_to_depreciate = serializers.DecimalField(max_digits=15, decimal_places=2)
    completion_percentage = serializers.FloatField()
    depreciation_method = serializers.CharField()
    useful_life_years = serializers.IntegerField()
    status = serializers.CharField()
    total_scheduled = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_posted = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_unposted = serializers.DecimalField(max_digits=15, decimal_places=2)
    schedule_entries_count = serializers.IntegerField()
    posted_entries_count = serializers.IntegerField()


class AssetRegisterSerializer(serializers.Serializer):
    """Serializer for asset register report."""

    asset_id = serializers.IntegerField()
    asset_name = serializers.CharField()
    category = serializers.CharField()
    purchase_date = serializers.DateField()
    purchase_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    accumulated_depreciation = serializers.DecimalField(max_digits=15, decimal_places=2)
    book_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    status = serializers.CharField()
    depreciation_method = serializers.CharField()
    useful_life_years = serializers.IntegerField()
