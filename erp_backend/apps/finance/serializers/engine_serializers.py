from rest_framework import serializers
from apps.finance.models import (
    OpeningBalance, AccountBalanceSnapshot,
    ReconciliationMatch, ReconciliationLine,
)


# ── Opening Balance ──────────────────────────────────────────────
class OpeningBalanceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    fiscal_year_name = serializers.CharField(source='fiscal_year.name', read_only=True)

    class Meta:
        model = OpeningBalance
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']


# ── Account Balance Snapshot ─────────────────────────────────────
class AccountBalanceSnapshotSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_type = serializers.CharField(source='account.type', read_only=True)
    period_name = serializers.CharField(source='fiscal_period.name', read_only=True)
    net_balance = serializers.SerializerMethodField()

    class Meta:
        model = AccountBalanceSnapshot
        fields = '__all__'
        read_only_fields = ['computed_at', 'is_stale']

    def get_net_balance(self, obj):
        return str(obj.closing_debit - obj.closing_credit)


# ── Reconciliation ───────────────────────────────────────────────
class ReconciliationLineSerializer(serializers.ModelSerializer):
    journal_ref = serializers.CharField(
        source='journal_entry_line.journal_entry.reference', read_only=True
    )
    journal_date = serializers.DateTimeField(
        source='journal_entry_line.journal_entry.transaction_date', read_only=True
    )
    journal_description = serializers.CharField(
        source='journal_entry_line.description', read_only=True
    )

    class Meta:
        model = ReconciliationLine
        fields = '__all__'


class ReconciliationMatchSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    lines = ReconciliationLineSerializer(many=True, read_only=True)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = ReconciliationMatch
        fields = '__all__'
        read_only_fields = ['matched_at', 'matched_by', 'unmatched_at', 'unmatched_by']

    def get_line_count(self, obj):
        return obj.lines.count()
