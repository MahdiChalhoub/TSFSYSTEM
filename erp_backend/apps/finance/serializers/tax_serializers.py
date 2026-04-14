from rest_framework import serializers
from apps.finance.models import TaxGroup, BarcodeSettings

class TaxGroupSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = TaxGroup
        fields = '__all__'

    def validate_rate(self, value):
        """Reject duplicate rates within the same organization."""
        from erp.middleware import get_current_tenant_id
        org_id = get_current_tenant_id()
        if not org_id:
            return value
        qs = TaxGroup.objects.filter(organization_id=org_id, rate=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            existing = qs.first()
            raise serializers.ValidationError(
                f'A tax group with rate {value}% already exists: "{existing.name}". '
                f'Each rate must be unique per organization.'
            )
        return value

class BarcodeSettingsSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = BarcodeSettings
        fields = '__all__'
