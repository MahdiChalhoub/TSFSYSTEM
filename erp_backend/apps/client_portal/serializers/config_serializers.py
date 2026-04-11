from rest_framework import serializers
from apps.client_portal.models import ClientPortalConfig

class ClientPortalConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientPortalConfig
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')
