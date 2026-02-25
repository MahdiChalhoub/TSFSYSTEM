from rest_framework import serializers
from apps.finance.models import TaxGroup, BarcodeSettings

class TaxGroupSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = TaxGroup
        fields = '__all__'

class BarcodeSettingsSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = BarcodeSettings
        fields = '__all__'
