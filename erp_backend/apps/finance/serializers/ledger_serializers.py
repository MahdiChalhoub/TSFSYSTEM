from rest_framework import serializers
from apps.finance.models import JournalEntry, JournalEntryLine, ChartOfAccount


class AccountNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChartOfAccount
        fields = ['id', 'code', 'name', 'type', 'sub_type']


class JournalEntryLineSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    account = AccountNestedSerializer(read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = '__all__'


class UserMinimalSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    first_name = serializers.CharField(allow_blank=True, default='')
    last_name = serializers.CharField(allow_blank=True, default='')


class JournalEntrySerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    created_by = UserMinimalSerializer(read_only=True)
    posted_by = UserMinimalSerializer(read_only=True)
    fiscal_year_name = serializers.CharField(source='fiscal_year.name', read_only=True, default=None)
    fiscal_period_name = serializers.CharField(source='fiscal_period.name', read_only=True, default=None)
    site_name = serializers.CharField(source='site.name', read_only=True, default=None)

    class Meta:
        model = JournalEntry
        fields = '__all__'
