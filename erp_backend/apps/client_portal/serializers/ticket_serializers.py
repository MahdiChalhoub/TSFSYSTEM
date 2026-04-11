from rest_framework import serializers
from apps.client_portal.models import ClientTicket

class ClientTicketSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.email', read_only=True, default=None)

    class Meta:
        model = ClientTicket
        fields = '__all__'
        read_only_fields = ('ticket_number', 'resolved_at', 'created_at', 'updated_at')
