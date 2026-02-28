"""
CRM Module Serializers
"""
from rest_framework import serializers
from apps.crm.models import Contact


class ContactSerializer(serializers.ModelSerializer):
    # Read-only: returns the zone name string so the POS can display/match it
    home_zone_name = serializers.CharField(source='home_zone.name', read_only=True, default=None)

    class Meta:
        model = Contact
        fields = '__all__'
