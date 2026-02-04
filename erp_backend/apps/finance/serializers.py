from rest_framework import serializers
from .models import (
    FinancialAccount, FiscalPeriod, FiscalYear, ChartOfAccount,
    JournalEntryLine, JournalEntry, LoanInstallment, Loan,
    FinancialEvent, Transaction
)
from erp.serializers_shared import UserValueSerializer

class FinancialAccountSerializer(serializers.ModelSerializer):
    site_name = serializers.ReadOnlyField(source='site.name')
    ledger_code = serializers.ReadOnlyField(source='ledger_account.code')
    assignedUsers = UserValueSerializer(source='assigned_users', many=True, read_only=True)

    class Meta:
        model = FinancialAccount
        fields = '__all__'
        read_only_fields = ('ledger_account', 'organization')

class FiscalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalPeriod
        fields = '__all__'

class FiscalYearSerializer(serializers.ModelSerializer):
    periods = FiscalPeriodSerializer(many=True, read_only=True)

    class Meta:
        model = FiscalYear
        fields = '__all__'
        read_only_fields = ('organization',)

class ChartOfAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChartOfAccount
        fields = '__all__'
        read_only_fields = ('organization',)

class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.name')
    account_code = serializers.ReadOnlyField(source='account.code')

    class Meta:
        model = JournalEntryLine
        fields = '__all__'

class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    site_name = serializers.ReadOnlyField(source='site.name')

    class Meta:
        model = JournalEntry
        fields = '__all__'

class LoanInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanInstallment
        fields = '__all__'

class LoanSerializer(serializers.ModelSerializer):
    installments = LoanInstallmentSerializer(many=True, read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')

    class Meta:
        model = Loan
        fields = '__all__'

class FinancialEventSerializer(serializers.ModelSerializer):
    contact_name = serializers.ReadOnlyField(source='contact.name')
    transaction_ref = serializers.ReadOnlyField(source='transaction.reference_id')
    journal_ref = serializers.ReadOnlyField(source='journal_entry.reference')

    class Meta:
        model = FinancialEvent
        fields = '__all__'

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'
