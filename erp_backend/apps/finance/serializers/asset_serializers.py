from rest_framework import serializers
from apps.finance.models import Asset, AmortizationSchedule

class AssetSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    depreciation_progress = serializers.SerializerMethodField()
    class Meta:
        model = Asset
        fields = '__all__'
    def get_depreciation_progress(self, obj):
        depreciable = obj.purchase_value - obj.residual_value
        if depreciable <= 0: return 100
        return round((float(obj.accumulated_depreciation) / float(depreciable)) * 100, 1)

class AmortizationScheduleSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = AmortizationSchedule
        fields = '__all__'
