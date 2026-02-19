"""
Finance Module Serializers
"""
from rest_framework import serializers
from .models import (
    ChartOfAccount, FinancialAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, Transaction, TransactionSequence,
    BarcodeSettings, Loan, LoanInstallment, FinancialEvent, ForensicAuditLog,
    DeferredExpense, DirectExpense, Asset, AmortizationSchedule, Voucher, ProfitDistribution,
    TaxGroup
)
from .payment_models import Payment, CustomerBalance, SupplierBalance


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


class TaxGroupSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = TaxGroup
        fields = '__all__'


# ── Payments & Balances ──────────────────────────────────────────

class PaymentSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    payment_account_name = serializers.ReadOnlyField(source='payment_account.name')
    invoice_number = serializers.ReadOnlyField(source='invoice.invoice_number')
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    allocation_count = serializers.SerializerMethodField()
    unallocated_amount = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['organization', 'reference']

    def get_allocation_count(self, obj):
        return obj.allocations.count() if hasattr(obj, 'allocations') else 0

    def get_unallocated_amount(self, obj):
        allocated = sum(a.allocated_amount for a in obj.allocations.all()) if hasattr(obj, 'allocations') else 0
        return float(obj.amount - allocated)


class CustomerBalanceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')

    class Meta:
        model = CustomerBalance
        fields = '__all__'


class SupplierBalanceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')

    class Meta:
        model = SupplierBalance
        fields = '__all__'


# ── Invoices ─────────────────────────────────────────────────────

from .invoice_models import Invoice, InvoiceLine, PaymentAllocation


class InvoiceLineSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')

    class Meta:
        model = InvoiceLine
        fields = '__all__'
        read_only_fields = ['organization', 'line_total_ht', 'tax_amount', 'line_total_ttc']


class InvoiceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    lines = InvoiceLineSerializer(many=True, read_only=True)
    contact_display = serializers.ReadOnlyField(source='contact.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    site_name = serializers.ReadOnlyField(source='site.name')
    line_count = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = [
            'organization', 'invoice_number', 'paid_amount', 'balance_due',
            'total_in_functional_currency', 'paid_at'
        ]

    def get_line_count(self, obj):
        return obj.lines.count()

    def get_is_overdue(self, obj):
        if obj.status in ('SENT', 'PARTIAL_PAID') and obj.due_date:
            from django.utils import timezone
            return obj.due_date < timezone.now().date()
        return False


class PaymentAllocationSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    invoice_number = serializers.ReadOnlyField(source='invoice.invoice_number')
    payment_reference = serializers.ReadOnlyField(source='payment.reference')

    class Meta:
        model = PaymentAllocation
        fields = '__all__'


