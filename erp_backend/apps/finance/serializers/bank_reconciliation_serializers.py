"""
Bank Reconciliation Serializers
================================
Serializers for bank statement import and reconciliation.
"""

from rest_framework import serializers
from apps.finance.models.bank_reconciliation_models import (
    BankStatement, BankStatementLine, ReconciliationSession
)
from apps.finance.models import FinancialAccount, JournalEntryLine


class BankStatementLineSerializer(serializers.ModelSerializer):
    """Serializer for bank statement lines."""

    matched_entry_details = serializers.SerializerMethodField()

    class Meta:
        model = BankStatementLine
        fields = [
            'id', 'line_number', 'transaction_date', 'value_date',
            'description', 'reference',
            'debit_amount', 'credit_amount', 'balance',
            'is_matched', 'matched_entry', 'matched_entry_details',
            'match_confidence', 'match_reason',
            'category', 'tags',
            'matched_by', 'matched_at'
        ]
        read_only_fields = [
            'id', 'is_matched', 'matched_entry', 'match_confidence',
            'matched_by', 'matched_at'
        ]

    def get_matched_entry_details(self, obj):
        """Get details of matched journal entry line."""
        if not obj.matched_entry:
            return None

        return {
            'id': obj.matched_entry.id,
            'entry_id': obj.matched_entry.entry.id,
            'entry_number': obj.matched_entry.entry.entry_number,
            'transaction_date': obj.matched_entry.entry.transaction_date,
            'description': obj.matched_entry.entry.description,
            'debit': obj.matched_entry.debit,
            'credit': obj.matched_entry.credit,
            'account_code': obj.matched_entry.account.code,
            'account_name': obj.matched_entry.account.name,
        }


class BankStatementSerializer(serializers.ModelSerializer):
    """Serializer for bank statements."""

    account_name = serializers.CharField(source='account.name', read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    lines = BankStatementLineSerializer(many=True, read_only=True)
    reconciliation_percentage = serializers.SerializerMethodField()

    class Meta:
        model = BankStatement
        fields = [
            'id', 'account', 'account_name', 'account_code',
            'statement_date', 'statement_number',
            'opening_balance', 'closing_balance', 'calculated_closing',
            'total_debits', 'total_credits',
            'file', 'status',
            'matched_count', 'unmatched_count', 'total_lines',
            'reconciliation_percentage',
            'reconciled_at', 'reconciled_by',
            'notes', 'lines',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'calculated_closing', 'total_debits', 'total_credits',
            'matched_count', 'unmatched_count', 'total_lines',
            'reconciled_at', 'reconciled_by',
            'created_at', 'updated_at'
        ]

    def get_reconciliation_percentage(self, obj):
        """Calculate reconciliation percentage."""
        if obj.total_lines == 0:
            return 0
        return round((obj.matched_count / obj.total_lines) * 100, 1)


class BankStatementImportSerializer(serializers.Serializer):
    """Serializer for bank statement import."""

    account = serializers.PrimaryKeyRelatedField(
        queryset=FinancialAccount.objects.all(),
        help_text='Financial account (bank account)'
    )
    statement_date = serializers.DateField(
        help_text='Statement date'
    )
    statement_number = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
        help_text='Optional statement number'
    )
    file = serializers.FileField(
        help_text='CSV or Excel file with bank transactions'
    )
    file_format = serializers.ChoiceField(
        choices=['AUTO', 'CSV', 'EXCEL'],
        default='AUTO',
        help_text='File format (AUTO auto-detects)'
    )

    def validate_account(self, value):
        """Validate account belongs to organization."""
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            if value.organization != request.organization:
                raise serializers.ValidationError("Account does not belong to your organization")
        return value


class ReconciliationSessionSerializer(serializers.ModelSerializer):
    """Serializer for reconciliation sessions."""

    started_by_name = serializers.CharField(source='started_by.get_full_name', read_only=True)
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = ReconciliationSession
        fields = [
            'id', 'statement',
            'started_by', 'started_by_name',
            'started_at', 'completed_at', 'duration_seconds', 'duration_display',
            'auto_matched_count', 'manual_matched_count', 'unmatched_count',
            'status', 'notes'
        ]
        read_only_fields = [
            'id', 'started_at', 'completed_at', 'duration_seconds',
            'auto_matched_count', 'manual_matched_count', 'unmatched_count'
        ]

    def get_duration_display(self, obj):
        """Format duration for display."""
        if not obj.duration_seconds:
            return None

        minutes = obj.duration_seconds // 60
        seconds = obj.duration_seconds % 60

        if minutes > 0:
            return f"{minutes}m {seconds}s"
        return f"{seconds}s"


class AutoMatchRequestSerializer(serializers.Serializer):
    """Serializer for auto-match request."""

    min_confidence = serializers.FloatField(
        default=0.8,
        min_value=0.0,
        max_value=1.0,
        help_text='Minimum confidence score (0.0-1.0)'
    )


class ManualMatchSerializer(serializers.Serializer):
    """Serializer for manual match request."""

    statement_line_id = serializers.IntegerField(
        help_text='BankStatementLine ID'
    )
    journal_entry_line_id = serializers.IntegerField(
        help_text='JournalEntryLine ID to match to'
    )

    def validate(self, data):
        """Validate both records exist and belong to organization."""
        request = self.context.get('request')
        org = request.organization if request and hasattr(request, 'organization') else None

        try:
            statement_line = BankStatementLine.objects.get(
                id=data['statement_line_id'],
                organization=org
            )
        except BankStatementLine.DoesNotExist:
            raise serializers.ValidationError({
                'statement_line_id': 'Statement line not found'
            })

        try:
            journal_line = JournalEntryLine.objects.get(
                id=data['journal_entry_line_id'],
                organization=org
            )
        except JournalEntryLine.DoesNotExist:
            raise serializers.ValidationError({
                'journal_entry_line_id': 'Journal entry line not found'
            })

        data['statement_line'] = statement_line
        data['journal_line'] = journal_line

        return data


class ReconciliationReportSerializer(serializers.Serializer):
    """Serializer for reconciliation report output."""

    statement_date = serializers.DateField()
    opening_balance = serializers.DecimalField(max_digits=15, decimal_places=2)
    closing_balance = serializers.DecimalField(max_digits=15, decimal_places=2)
    expected_closing = serializers.DecimalField(max_digits=15, decimal_places=2)
    variance = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_lines = serializers.IntegerField()
    matched_count = serializers.IntegerField()
    unmatched_count = serializers.IntegerField()
    matched_debit = serializers.DecimalField(max_digits=15, decimal_places=2)
    matched_credit = serializers.DecimalField(max_digits=15, decimal_places=2)
    unmatched_debit = serializers.DecimalField(max_digits=15, decimal_places=2)
    unmatched_credit = serializers.DecimalField(max_digits=15, decimal_places=2)
    reconciliation_percentage = serializers.FloatField()
