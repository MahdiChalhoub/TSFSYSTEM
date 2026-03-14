"""
Financial Report Serializers
=============================
Serializers for financial reports output.
"""

from rest_framework import serializers


class TrialBalanceLineSerializer(serializers.Serializer):
    """Serializer for trial balance line."""

    account_code = serializers.CharField()
    account_name = serializers.CharField()
    account_type = serializers.CharField()
    opening_debit = serializers.DecimalField(max_digits=15, decimal_places=2)
    opening_credit = serializers.DecimalField(max_digits=15, decimal_places=2)
    period_debit = serializers.DecimalField(max_digits=15, decimal_places=2)
    period_credit = serializers.DecimalField(max_digits=15, decimal_places=2)
    closing_debit = serializers.DecimalField(max_digits=15, decimal_places=2)
    closing_credit = serializers.DecimalField(max_digits=15, decimal_places=2)


class TrialBalanceTotalsSerializer(serializers.Serializer):
    """Serializer for trial balance totals."""

    opening_debit = serializers.DecimalField(max_digits=15, decimal_places=2)
    opening_credit = serializers.DecimalField(max_digits=15, decimal_places=2)
    period_debit = serializers.DecimalField(max_digits=15, decimal_places=2)
    period_credit = serializers.DecimalField(max_digits=15, decimal_places=2)
    closing_debit = serializers.DecimalField(max_digits=15, decimal_places=2)
    closing_credit = serializers.DecimalField(max_digits=15, decimal_places=2)


class TrialBalanceSerializer(serializers.Serializer):
    """Serializer for trial balance report."""

    organization = serializers.CharField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    lines = TrialBalanceLineSerializer(many=True)
    totals = TrialBalanceTotalsSerializer()
    is_balanced = serializers.BooleanField()


class ProfitLossLineSerializer(serializers.Serializer):
    """Serializer for P&L line item."""

    account_code = serializers.CharField()
    account_name = serializers.CharField()
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)


class ProfitLossSectionSerializer(serializers.Serializer):
    """Serializer for P&L section (revenue/expenses)."""

    lines = ProfitLossLineSerializer(many=True)
    total = serializers.DecimalField(max_digits=15, decimal_places=2)


class ProfitLossSerializer(serializers.Serializer):
    """Serializer for profit & loss statement."""

    organization = serializers.CharField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    revenue = ProfitLossSectionSerializer()
    expenses = ProfitLossSectionSerializer()
    net_income = serializers.DecimalField(max_digits=15, decimal_places=2)
    net_margin_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)


class BalanceSheetLineSerializer(serializers.Serializer):
    """Serializer for balance sheet line item."""

    account_code = serializers.CharField()
    account_name = serializers.CharField()
    balance = serializers.DecimalField(max_digits=15, decimal_places=2)


class BalanceSheetSectionSerializer(serializers.Serializer):
    """Serializer for balance sheet section."""

    lines = BalanceSheetLineSerializer(many=True)
    total = serializers.DecimalField(max_digits=15, decimal_places=2)


class BalanceSheetEquitySerializer(serializers.Serializer):
    """Serializer for equity section."""

    lines = BalanceSheetLineSerializer(many=True)
    retained_earnings = serializers.DecimalField(max_digits=15, decimal_places=2)
    total = serializers.DecimalField(max_digits=15, decimal_places=2)


class BalanceSheetSerializer(serializers.Serializer):
    """Serializer for balance sheet."""

    organization = serializers.CharField()
    as_of_date = serializers.DateField()
    assets = BalanceSheetSectionSerializer()
    liabilities = BalanceSheetSectionSerializer()
    equity = BalanceSheetEquitySerializer()
    total_liabilities_equity = serializers.DecimalField(max_digits=15, decimal_places=2)
    is_balanced = serializers.BooleanField()


class CashFlowAdjustmentSerializer(serializers.Serializer):
    """Serializer for cash flow adjustment."""

    description = serializers.CharField()
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)


class CashFlowItemSerializer(serializers.Serializer):
    """Serializer for cash flow item."""

    description = serializers.CharField()
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)


class CashFlowOperatingSerializer(serializers.Serializer):
    """Serializer for operating activities."""

    net_income = serializers.DecimalField(max_digits=15, decimal_places=2)
    adjustments = CashFlowAdjustmentSerializer(many=True)
    total = serializers.DecimalField(max_digits=15, decimal_places=2)


class CashFlowActivitySerializer(serializers.Serializer):
    """Serializer for investing/financing activities."""

    items = CashFlowItemSerializer(many=True)
    total = serializers.DecimalField(max_digits=15, decimal_places=2)


class CashFlowSerializer(serializers.Serializer):
    """Serializer for cash flow statement."""

    organization = serializers.CharField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    method = serializers.CharField()
    operating_activities = CashFlowOperatingSerializer()
    investing_activities = CashFlowActivitySerializer()
    financing_activities = CashFlowActivitySerializer()
    net_cash_change = serializers.DecimalField(max_digits=15, decimal_places=2)
    beginning_cash = serializers.DecimalField(max_digits=15, decimal_places=2)
    ending_cash = serializers.DecimalField(max_digits=15, decimal_places=2)


class ReportParametersSerializer(serializers.Serializer):
    """Serializer for report parameters."""

    start_date = serializers.DateField(required=True)
    end_date = serializers.DateField(required=True)
    include_opening = serializers.BooleanField(default=True, required=False)
    include_closing = serializers.BooleanField(default=True, required=False)
    comparative = serializers.BooleanField(default=False, required=False)
    previous_start = serializers.DateField(required=False, allow_null=True)
    previous_end = serializers.DateField(required=False, allow_null=True)
    method = serializers.ChoiceField(
        choices=['INDIRECT', 'DIRECT'],
        default='INDIRECT',
        required=False
    )
