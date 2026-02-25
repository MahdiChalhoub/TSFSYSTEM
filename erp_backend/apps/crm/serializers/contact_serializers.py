"""
CRM Module Serializers
"""
from rest_framework import serializers
from apps.crm.models import Contact


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = '__all__'
