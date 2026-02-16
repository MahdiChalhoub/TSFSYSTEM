"""
Finance Module Serializers
"""
from rest_framework import serializers
from .models import (
    ChartOfAccount, FinancialAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, Transaction, TransactionSequence,
    BarcodeSettings, Loan, LoanInstallment, FinancialEvent, ForensicAuditLog
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

