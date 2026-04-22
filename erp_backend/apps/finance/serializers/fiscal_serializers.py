from rest_framework import serializers
from apps.finance.models import FiscalYear, FiscalPeriod

class FiscalPeriodSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    is_posting_allowed = serializers.BooleanField(read_only=True)
    is_supervisor_posting_allowed = serializers.BooleanField(read_only=True)
    journal_entry_count = serializers.SerializerMethodField()
    draft_je_count = serializers.SerializerMethodField()
    draft_je_refs = serializers.SerializerMethodField()

    class Meta:
        model = FiscalPeriod
        fields = '__all__'

    def get_journal_entry_count(self, obj):
        from apps.finance.models import JournalEntry
        from django.db.models import Q
        return JournalEntry.objects.filter(
            organization=obj.organization,
        ).filter(
            Q(fiscal_period=obj) |
            Q(fiscal_period__isnull=True,
              transaction_date__date__gte=obj.start_date,
              transaction_date__date__lte=obj.end_date)
        ).count()

    def get_draft_je_count(self, obj):
        from apps.finance.models import JournalEntry
        from django.db.models import Q
        return JournalEntry.objects.filter(
            organization=obj.organization, status='DRAFT',
        ).filter(
            Q(fiscal_period=obj) |
            Q(fiscal_period__isnull=True,
              transaction_date__date__gte=obj.start_date,
              transaction_date__date__lte=obj.end_date)
        ).count()

    def get_draft_je_refs(self, obj):
        from apps.finance.models import JournalEntry
        from django.db.models import Q
        drafts = JournalEntry.objects.filter(
            organization=obj.organization, status='DRAFT',
        ).filter(
            Q(fiscal_period=obj) |
            Q(fiscal_period__isnull=True,
              transaction_date__date__gte=obj.start_date,
              transaction_date__date__lte=obj.end_date)
        ).values_list('reference', flat=True)[:10]
        return list(drafts)

class FiscalYearSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    periods = FiscalPeriodSerializer(many=True, read_only=True)
    is_posting_allowed = serializers.BooleanField(read_only=True)
    class Meta:
        model = FiscalYear
        fields = '__all__'

