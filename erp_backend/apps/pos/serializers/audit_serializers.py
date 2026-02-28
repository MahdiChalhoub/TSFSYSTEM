from rest_framework import serializers
from apps.pos.models import POSAuditEvent, POSAuditRule
from .register_serializers import POSRegisterSerializer
from erp.serializers import UserSerializer

class POSAuditRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = POSAuditRule
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')

class POSAuditEventSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    register_name = serializers.CharField(source='register.name', read_only=True, default=None)
    reviewed_by_name = serializers.SerializerMethodField()

    def get_user_name(self, obj):
        if not obj.user:
            return 'System'
        full = obj.user.get_full_name()
        return full if full.strip() else obj.user.username

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        full = obj.reviewed_by.get_full_name()
        return full if full.strip() else obj.reviewed_by.username

    class Meta:
        model = POSAuditEvent
        fields = '__all__'
        read_only_fields = ('organization', 'created_at')
