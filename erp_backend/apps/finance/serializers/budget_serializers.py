"""
Budget Serializers
==================
Serializers for budget management and variance analysis.
"""

from rest_framework import serializers
from apps.finance.models.budget_models import Budget, BudgetLine


class BudgetLineSerializer(serializers.ModelSerializer):
    """Serializer for budget lines with variance details."""

    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    period_name = serializers.CharField(source='fiscal_period.name', read_only=True, allow_null=True)

    # Computed fields
    is_over_budget = serializers.SerializerMethodField()
    utilization_percentage = serializers.SerializerMethodField()

    class Meta:
        model = BudgetLine
        fields = [
            'id', 'budget', 'account', 'account_code', 'account_name',
            'fiscal_period', 'period_name', 'cost_center',
            'budgeted_amount', 'actual_amount', 'committed_amount',
            'variance_amount', 'variance_percentage', 'available_amount',
            'is_over_budget', 'utilization_percentage',
            'notes'
        ]
        read_only_fields = [
            'id', 'account_code', 'account_name', 'period_name',
            'variance_amount', 'variance_percentage', 'available_amount',
            'is_over_budget', 'utilization_percentage'
        ]

    def get_is_over_budget(self, obj):
        """Check if line is over budget."""
        return obj.variance_amount < 0

    def get_utilization_percentage(self, obj):
        """Calculate budget utilization percentage."""
        if obj.budgeted_amount > 0:
            return round(float(obj.actual_amount / obj.budgeted_amount * 100), 1)
        return 0.0


class BudgetSerializer(serializers.ModelSerializer):
    """Enhanced serializer for budgets."""

    fiscal_year_name = serializers.CharField(source='fiscal_year.name', read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True,
        allow_null=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name',
        read_only=True,
        allow_null=True
    )

    # Include lines
    lines = BudgetLineSerializer(many=True, read_only=True)

    # Computed fields
    line_count = serializers.SerializerMethodField()
    total_actual = serializers.SerializerMethodField()
    total_variance = serializers.SerializerMethodField()
    variance_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = [
            'id', 'name', 'fiscal_year', 'fiscal_year_name',
            'version', 'status', 'scope', 'description',
            'total_budget', 'total_actual', 'total_variance', 'variance_percentage',
            'line_count',
            'created_at', 'created_by', 'created_by_name',
            'approved_at', 'approved_by', 'approved_by_name',
            'lines'
        ]
        read_only_fields = [
            'id', 'created_at', 'approved_at',
            'fiscal_year_name', 'created_by_name', 'approved_by_name',
            'total_actual', 'total_variance', 'variance_percentage', 'line_count'
        ]

    def get_line_count(self, obj):
        """Get number of budget lines."""
        return obj.lines.count()

    def get_total_actual(self, obj):
        """Get total actual amount."""
        return sum(line.actual_amount for line in obj.lines.all())

    def get_total_variance(self, obj):
        """Get total variance."""
        return sum(line.variance_amount for line in obj.lines.all())

    def get_variance_percentage(self, obj):
        """Get total variance percentage."""
        total_budget = obj.total_budget
        total_actual = self.get_total_actual(obj)
        if total_budget > 0:
            variance = total_budget - total_actual
            return round(float(variance / total_budget * 100), 1)
        return 0.0


class VarianceReportSerializer(serializers.Serializer):
    """Serializer for variance report output."""

    budget_id = serializers.IntegerField()
    budget_name = serializers.CharField()
    fiscal_year = serializers.CharField()
    total_budget = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_actual = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_committed = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_variance = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_available = serializers.DecimalField(max_digits=15, decimal_places=2)
    variance_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    utilization_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    over_budget_count = serializers.IntegerField()


class VarianceAlertSerializer(serializers.Serializer):
    """Serializer for variance alert output."""

    severity = serializers.ChoiceField(choices=['CRITICAL', 'WARNING', 'INFO'])
    budget_line_id = serializers.IntegerField()
    account_code = serializers.CharField()
    account_name = serializers.CharField()
    period = serializers.CharField()
    cost_center = serializers.CharField(allow_null=True)
    budgeted_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    actual_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    variance_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    variance_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    over_budget_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    over_budget_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    message = serializers.CharField()


class BudgetPerformanceSerializer(serializers.Serializer):
    """Serializer for budget performance summary."""

    total_budget = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_actual = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_variance = serializers.DecimalField(max_digits=15, decimal_places=2)
    variance_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    lines_count = serializers.IntegerField()
    over_budget_count = serializers.IntegerField()
    under_budget_count = serializers.IntegerField()
    on_budget_count = serializers.IntegerField()
    over_budget_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    under_budget_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    utilization_rate = serializers.DecimalField(max_digits=8, decimal_places=2)


class RefreshActualsSerializer(serializers.Serializer):
    """Serializer for refresh actuals request."""

    force = serializers.BooleanField(
        default=False,
        help_text='Force refresh even if recently updated'
    )
