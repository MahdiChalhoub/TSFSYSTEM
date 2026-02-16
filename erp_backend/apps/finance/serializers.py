"""
Finance Module Serializers
"""
from rest_framework import serializers
from .models import (
    ChartOfAccount, FinancialAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, Transaction, TransactionSequence,
    BarcodeSettings, Loan, LoanInstallment, FinancialEvent, ForensicAuditLog,
    DeferredExpense, DirectExpense, Asset, AmortizationSchedule, Voucher, ProfitDistribution
)


class ForensicAuditLogSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    actor_name = serializers.ReadOnlyField(source='actor.username')

    class Meta:
        model = ForensicAuditLog
        fields = '__all__'


class ChartOfAccountSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ChartOfAccount
        fields = '__all__'


class FinancialAccountSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FinancialAccount
        fields = '__all__'


class FiscalPeriodSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FiscalPeriod
        fields = '__all__'


class FiscalYearSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    periods = FiscalPeriodSerializer(many=True, read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = FiscalYear
        fields = '__all__'

    def get_status(self, obj):
        if obj.is_hard_locked:
            return 'FINALIZED'
        if obj.is_closed:
            return 'CLOSED'
        return 'OPEN'


class JournalEntryLineSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = '__all__'


class JournalEntrySerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    lines = JournalEntryLineSerializer(many=True, read_only=True)

    class Meta:
        model = JournalEntry
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Transaction
        fields = '__all__'


class TransactionSequenceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = TransactionSequence
        fields = '__all__'


class BarcodeSettingsSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = BarcodeSettings
        fields = '__all__'


class LoanSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Loan
        fields = '__all__'


class LoanInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanInstallment
        fields = '__all__'


class FinancialEventSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FinancialEvent
        fields = '__all__'


class DeferredExpenseSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = DeferredExpense
        fields = '__all__'

    def get_progress(self, obj):
        if obj.duration_months == 0:
            return 100
        return round((obj.months_recognized / obj.duration_months) * 100, 1)


class DirectExpenseSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    source_account_name = serializers.ReadOnlyField(source='source_account.name')
    expense_coa_name = serializers.ReadOnlyField(source='expense_coa.name')

    class Meta:
        model = DirectExpense
        fields = '__all__'


class AssetSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    depreciation_progress = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = '__all__'

    def get_depreciation_progress(self, obj):
        depreciable = obj.purchase_value - obj.residual_value
        if depreciable <= 0:
            return 100
        return round((float(obj.accumulated_depreciation) / float(depreciable)) * 100, 1)


class AmortizationScheduleSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = AmortizationSchedule
        fields = '__all__'


class VoucherSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    source_account_name = serializers.ReadOnlyField(source='source_account.name')
    destination_account_name = serializers.ReadOnlyField(source='destination_account.name')
    locked_by_name = serializers.CharField(source='locked_by.username', read_only=True, default=None)

    class Meta:
        model = Voucher
        fields = [
            'id', 'voucher_type', 'amount', 'date', 'reference', 'description',
            'source_account', 'source_account_name',
            'destination_account', 'destination_account_name',
            'financial_event', 'contact', 'journal_entry',
            'scope', 'is_posted',
            'lifecycle_status', 'locked_by', 'locked_by_name',
            'locked_at', 'current_verification_level',
            'created_at', 'updated_at', 'organization',
        ]
        read_only_fields = ['organization', 'reference', 'is_posted',
                            'lifecycle_status', 'locked_by', 'locked_at',
                            'current_verification_level']


class ProfitDistributionSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    fiscal_year_name = serializers.ReadOnlyField(source='fiscal_year.name')

    class Meta:
        model = ProfitDistribution
        fields = '__all__'
