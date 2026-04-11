"""
IAM Serializers — DTOs for ContactPortalAccess and PortalApprovalRequest.

Separate from ERP serializers. Portal endpoints should use portal-specific
serializers to avoid leaking internal data.
"""
from rest_framework import serializers
from apps.iam.models import ContactPortalAccess, PortalApprovalRequest


class ContactPortalAccessSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    contact_type = serializers.CharField(source='contact.type', read_only=True)
    granted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ContactPortalAccess
        fields = [
            'id', 'user', 'user_email', 'user_name',
            'contact', 'contact_name', 'contact_type',
            'portal_type', 'status', 'relationship_role', 'is_primary',
            'created_via',
            'can_access_portal', 'can_access_ecommerce',
            'granted_by', 'granted_by_name', 'granted_at',
            'revoked_by', 'revoked_at', 'revoke_reason',
            'last_portal_login', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user_email', 'user_name', 'contact_name', 'contact_type',
            'granted_by_name', 'granted_at', 'revoked_at',
            'last_portal_login', 'created_at', 'updated_at',
        ]

    def _display_name(self, user):
        if not user:
            return None
        name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return name or user.username

    def get_user_name(self, obj):
        return self._display_name(obj.user)

    def get_granted_by_name(self, obj):
        return self._display_name(obj.granted_by)


class PortalApprovalRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='target_user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PortalApprovalRequest
        fields = [
            'id', 'request_type', 'status',
            'target_user', 'user_email', 'user_name',
            'target_contact', 'contact_name',
            'resulting_access',
            'submitted_data',
            'review_notes', 'correction_notes',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user_email', 'user_name', 'contact_name',
            'reviewed_by_name', 'reviewed_at', 'resulting_access',
            'created_at', 'updated_at',
        ]

    def _display_name(self, user):
        if not user:
            return None
        name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return name or user.username

    def get_user_name(self, obj):
        return self._display_name(obj.target_user)

    def get_contact_name(self, obj):
        return obj.target_contact.name if obj.target_contact else None

    def get_reviewed_by_name(self, obj):
        return self._display_name(obj.reviewed_by)
