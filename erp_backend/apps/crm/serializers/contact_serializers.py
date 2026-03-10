"""
CRM Module Serializers
"""
from rest_framework import serializers
from apps.crm.models import Contact, ContactTag


class ContactTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactTag
        fields = '__all__'


class ContactSerializer(serializers.ModelSerializer):
    # Read-only: returns the zone name string so the POS can display/match it
    home_zone_name = serializers.CharField(source='home_zone.name', read_only=True, default=None)
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = '__all__'

    def get_tag_names(self, obj):
        try:
            return [{'id': t.id, 'name': t.name, 'color': t.color} for t in obj.tags.all()]
        except Exception:
            return []
