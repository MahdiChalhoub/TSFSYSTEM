from rest_framework import serializers
from apps.finance.models import ForensicAuditLog, ProfitDistribution

class ForensicAuditLogSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    actor_name = serializers.ReadOnlyField(source='actor.username')
    class Meta:
        model = ForensicAuditLog
        fields = '__all__'

class ProfitDistributionSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    fiscal_year_name = serializers.ReadOnlyField(source='fiscal_year.name')
    class Meta:
        model = ProfitDistribution
        fields = '__all__'
