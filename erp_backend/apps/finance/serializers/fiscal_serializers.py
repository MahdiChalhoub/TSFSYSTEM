from rest_framework import serializers
from apps.finance.models import FiscalYear, FiscalPeriod

class FiscalPeriodSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    is_posting_allowed = serializers.BooleanField(read_only=True)
    is_supervisor_posting_allowed = serializers.BooleanField(read_only=True)
    journal_entry_count = serializers.SerializerMethodField()

    class Meta:
        model = FiscalPeriod
        fields = '__all__'

    def get_journal_entry_count(self, obj):
        from apps.finance.models import JournalEntry
        return JournalEntry.objects.filter(fiscal_period=obj).count()

class FiscalYearSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    periods = FiscalPeriodSerializer(many=True, read_only=True)
    is_posting_allowed = serializers.BooleanField(read_only=True)
    class Meta:
        model = FiscalYear
        fields = '__all__'

