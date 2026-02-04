# Finance Module Serializers
# Uses models from erp.models (re-exported via apps.finance.models)

from rest_framework import serializers
from erp.models import (
    FinancialAccount, ChartOfAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, Loan, LoanInstallment,
    FinancialEvent, Transaction
)


class FinancialAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialAccount
        fields = '__all__'


class ChartOfAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChartOfAccount
        fields = '__all__'


class FiscalYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalYear
        fields = '__all__'


class FiscalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalPeriod
        fields = '__all__'


class JournalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = '__all__'


class JournalEntryLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntryLine
        fields = '__all__'


class LoanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = '__all__'


class LoanInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanInstallment
        fields = '__all__'


class FinancialEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialEvent
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'
