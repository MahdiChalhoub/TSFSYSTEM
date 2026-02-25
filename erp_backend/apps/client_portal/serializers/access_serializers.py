from rest_framework import serializers
from apps.client_portal.models import ClientPortalAccess

class ClientPortalAccessSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    granted_by_name = serializers.CharField(source='granted_by.email', read_only=True, default=None)

    class Meta:
        model = ClientPortalAccess
        fields = '__all__'
        read_only_fields = ('granted_at', 'last_login', 'barcode')
