"""
Loan Serializers
================
Enhanced serializers for loan management with amortization schedules.
"""

from rest_framework import serializers
from apps.finance.models import Loan, LoanInstallment, FinancialEvent


class LoanInstallmentSerializer(serializers.ModelSerializer):
    """Serializer for loan installments."""

    outstanding = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    days_overdue = serializers.SerializerMethodField()

    class Meta:
        model = LoanInstallment
        fields = [
            'id', 'loan', 'installment_number', 'due_date',
            'principal_amount', 'interest_amount', 'total_amount',
            'paid_amount', 'outstanding',
            'balance_after',
            'is_paid', 'status', 'paid_at',
            'is_overdue', 'days_overdue'
        ]
        read_only_fields = ['id', 'outstanding', 'is_overdue', 'days_overdue']

    def get_outstanding(self, obj):
        """Calculate outstanding amount."""
        return obj.total_amount - obj.paid_amount

    def get_is_overdue(self, obj):
        """Check if installment is overdue."""
        from datetime import date
        if obj.is_paid:
            return False
        return obj.due_date < date.today() if obj.due_date else False

    def get_days_overdue(self, obj):
        """Calculate days overdue."""
        from datetime import date
        if obj.is_paid or not obj.due_date:
            return 0
        if obj.due_date >= date.today():
            return 0
        return (date.today() - obj.due_date).days


class LoanSerializer(serializers.ModelSerializer):
    """Enhanced serializer for loans."""

    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.CharField(source='contact.display_name', read_only=True)
    installments = LoanInstallmentSerializer(many=True, read_only=True)

    # Computed fields
    total_installments = serializers.SerializerMethodField()
    paid_installments = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()
    next_payment_due = serializers.SerializerMethodField()
    next_payment_amount = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            'id', 'contract_number', 'contact', 'contact_name',
            'principal_amount', 'interest_rate', 'interest_type',
            'amortization_method',
            'term_months', 'start_date', 'disbursement_date',
            'payment_frequency', 'status', 'scope',
            'installments',
            'total_installments', 'paid_installments', 'total_paid',
            'outstanding_balance',
            'next_payment_due', 'next_payment_amount',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'contract_number', 'created_at', 'updated_at',
            'total_installments', 'paid_installments', 'total_paid',
            'outstanding_balance', 'next_payment_due', 'next_payment_amount'
        ]

    def get_total_installments(self, obj):
        """Get total number of installments."""
        return obj.installments.count()

    def get_paid_installments(self, obj):
        """Get number of paid installments."""
        return obj.installments.filter(is_paid=True).count()

    def get_total_paid(self, obj):
        """Get total amount paid."""
        return sum(inst.paid_amount for inst in obj.installments.all())

    def get_outstanding_balance(self, obj):
        """Get total outstanding balance."""
        return sum(
            inst.total_amount - inst.paid_amount
            for inst in obj.installments.filter(is_paid=False)
        )

    def get_next_payment_due(self, obj):
        """Get next payment due date."""
        next_inst = obj.installments.filter(is_paid=False).order_by('due_date').first()
        return next_inst.due_date if next_inst else None

    def get_next_payment_amount(self, obj):
        """Get next payment amount."""
        next_inst = obj.installments.filter(is_paid=False).order_by('due_date').first()
        if not next_inst:
            return 0
        return next_inst.total_amount - next_inst.paid_amount


class LoanCreateSerializer(serializers.Serializer):
    """Serializer for creating new loans."""

    contact_id = serializers.IntegerField(
        help_text='Contact ID (borrower/lender)'
    )
    principal_amount = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text='Loan principal amount'
    )
    interest_rate = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Annual interest rate (%)'
    )
    interest_type = serializers.ChoiceField(
        choices=['SIMPLE', 'COMPOUND'],
        default='SIMPLE',
        help_text='Interest calculation type (legacy field)'
    )
    amortization_method = serializers.ChoiceField(
        choices=['REDUCING_BALANCE', 'FLAT_RATE', 'BALLOON', 'INTEREST_ONLY'],
        default='REDUCING_BALANCE',
        help_text='Amortization calculation method'
    )
    term_months = serializers.IntegerField(
        min_value=1,
        help_text='Loan term in months'
    )
    start_date = serializers.DateField(
        help_text='Loan start date'
    )
    payment_frequency = serializers.ChoiceField(
        choices=['MONTHLY', 'QUARTERLY', 'YEARLY'],
        default='MONTHLY',
        help_text='Payment frequency'
    )
    scope = serializers.ChoiceField(
        choices=['OFFICIAL', 'SANDBOX'],
        default='OFFICIAL',
        help_text='Loan scope'
    )


class LoanDisbursementSerializer(serializers.Serializer):
    """Serializer for loan disbursement."""

    disbursement_account_id = serializers.IntegerField(
        help_text='Bank/cash account for disbursement'
    )
    loan_payable_account_id = serializers.IntegerField(
        help_text='Loan payable liability account'
    )
    reference = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
        help_text='Transaction reference'
    )


class LoanPaymentSerializer(serializers.Serializer):
    """Serializer for loan payment."""

    amount = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text='Payment amount'
    )
    payment_account_id = serializers.IntegerField(
        help_text='Payment account (bank/cash)'
    )
    reference = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
        help_text='Payment reference'
    )
    scope = serializers.ChoiceField(
        choices=['OFFICIAL', 'SANDBOX'],
        default='OFFICIAL',
        help_text='Payment scope'
    )


class AmortizationScheduleSerializer(serializers.Serializer):
    """Serializer for amortization schedule output."""

    installment_number = serializers.IntegerField()
    due_date = serializers.DateField()
    principal = serializers.DecimalField(max_digits=15, decimal_places=2)
    interest = serializers.DecimalField(max_digits=15, decimal_places=2)
    total = serializers.DecimalField(max_digits=15, decimal_places=2)
    balance_after = serializers.DecimalField(max_digits=15, decimal_places=2)


class EarlyPayoffSerializer(serializers.Serializer):
    """Serializer for early payoff calculation output."""

    payoff_date = serializers.DateField()
    total_payoff_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    principal_outstanding = serializers.DecimalField(max_digits=15, decimal_places=2)
    interest_outstanding = serializers.DecimalField(max_digits=15, decimal_places=2)
    unpaid_installments_count = serializers.IntegerField()


class FinancialEventSerializer(serializers.ModelSerializer):
    """Serializer for financial events."""

    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.CharField(source='contact.display_name', read_only=True, allow_null=True)
    loan_number = serializers.CharField(source='loan.contract_number', read_only=True, allow_null=True)

    class Meta:
        model = FinancialEvent
        fields = [
            'id', 'event_type', 'amount', 'currency',
            'contact', 'contact_name',
            'loan', 'loan_number',
            'financial_account', 'transaction',
            'date', 'reference', 'scope', 'notes', 'status',
            'journal_entry',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'contact_name', 'loan_number']
