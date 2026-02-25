from rest_framework import serializers
from apps.finance.models import FiscalYear, FiscalPeriod

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
        if obj.is_hard_locked: return 'FINALIZED'
        if obj.is_closed: return 'CLOSED'
        return 'OPEN'
