"""
CRM Module Serializers
======================
Enterprise-hardened serialization with lifecycle fields,
validation invariants, and audit-aware sensitive field tracking.
"""
from rest_framework import serializers
from apps.crm.models import Contact, ContactTag, ContactPerson, ContactAuditLog, ContactComplianceDocument, ContactTask
from apps.storage.serializers.storage_serializers import StoredFileSerializer


# ── Sensitive fields that require audit logging on change ──
AUDITED_FIELDS = {
    'credit_limit', 'payment_terms_days', 'preferred_payment_method',
    'linked_account_id', 'linked_payable_account_id',
    'tax_profile_id', 'is_airsi_subject', 'airsi_tax_rate',
    'supplier_vat_regime', 'customer_tier', 'status', 'commercial_status',
    'is_vat_exonerated', 'is_airsi_exonerated', 'tax_id', 'reg_number'
}


class ContactTagSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    children_count = serializers.IntegerField(source='children.count', read_only=True, default=0)

    class Meta:
        model = ContactTag
        fields = '__all__'


class ContactPersonSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = ContactPerson
        fields = '__all__'


class ContactComplianceDocumentSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    review_status_display = serializers.CharField(source='get_review_status_display', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    attachment_data = StoredFileSerializer(source='attachment', read_only=True)

    class Meta:
        model = ContactComplianceDocument
        fields = '__all__'


class ContactTaskSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = ContactTask
        fields = '__all__'


class ContactSerializer(serializers.ModelSerializer):
    # Read-only computed fields
    home_zone_name = serializers.CharField(source='home_zone.name', read_only=True, default=None)
    tag_names = serializers.SerializerMethodField()
    entity_type_display = serializers.CharField(source='get_entity_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    commercial_status_display = serializers.CharField(source='get_commercial_status_display', read_only=True)
    people = ContactPersonSerializer(many=True, read_only=True)
    people_count = serializers.SerializerMethodField()

    # Governance & Compliance (11/10 Enterprise)
    compliance_documents = ContactComplianceDocumentSerializer(many=True, read_only=True)
    compliance_summary = serializers.SerializerMethodField()
    # We rename the method field to avoid shadowing the new model field 'compliance_status'
    compliance_check_details = serializers.SerializerMethodField()
    tasks = ContactTaskSerializer(many=True, read_only=True)

    class Meta:
        model = Contact
        fields = '__all__'

    def get_compliance_summary(self, obj):
        try:
            docs = obj.compliance_documents.filter(is_active=True)
            return {
                'total_docs': docs.count(),
                'expired_count': sum(1 for d in docs if d.is_expired),
                'verified_count': docs.filter(is_verified=True).count(),
                'approved_count': docs.filter(review_status='APPROVED').count(),
                'pending_count': docs.filter(review_status__in=['UPLOADED', 'UNDER_REVIEW']).count(),
                'score': float(obj.compliance_score or 100),
                'risk': obj.compliance_risk_level
            }
        except Exception:
            return {}

    def get_compliance_check_details(self, obj):
        """Returns the dynamic result of check_compliance()."""
        try:
            is_compliant, missing, expired, msg = obj.check_compliance()
            return {
                'is_compliant': is_compliant,
                'status': obj.compliance_status,
                'missing_docs': missing,
                'expired_docs': expired,
                'error_message': msg,
                'last_checked': obj.compliance_last_checked,
                'next_expiry': obj.compliance_next_expiry
            }
        except Exception as e:
            return {'error': str(e)}

    def get_tag_names(self, obj):
        try:
            return [{'id': t.id, 'name': t.name, 'color': t.color} for t in obj.tags.all()]
        except Exception:
            return []

    def get_people_count(self, obj):
        try:
            return obj.people.filter(is_active=True).count()
        except Exception:
            return 0

    def validate_credit_limit(self, value):
        """credit_limit >= 0"""
        if value is not None and value < 0:
            raise serializers.ValidationError('Credit limit cannot be negative.')
        return value

    def validate_payment_terms_days(self, value):
        """payment_terms_days >= 0"""
        if value is not None and value < 0:
            raise serializers.ValidationError('Payment terms cannot be negative.')
        return value

    def validate_wallet_balance(self, value):
        """wallet_balance >= 0"""
        if value is not None and value < 0:
            raise serializers.ValidationError('Wallet balance cannot be negative.')
        return value

    def validate(self, attrs):
        """Cross-field validation."""
        contact_type = attrs.get('type', getattr(self.instance, 'type', None))
        status = attrs.get('status', getattr(self.instance, 'status', 'ACTIVE'))

        # MERGED requires merged_into_contact_id
        if status == 'MERGED' and not attrs.get('merged_into_contact_id'):
            if not (self.instance and self.instance.merged_into_contact_id):
                raise serializers.ValidationError({
                    'merged_into_contact_id': 'Merged contacts must reference the surviving master record.'
                })

        # BLOCKED requires reason
        if status == 'BLOCKED' and not attrs.get('blocked_reason'):
            if not (self.instance and self.instance.blocked_reason):
                raise serializers.ValidationError({
                    'blocked_reason': 'Blocked contacts must have a reason documented.'
                })

        # LEAD/CONTACT should not have linked_account_id
        if contact_type in ('LEAD', 'CONTACT') and attrs.get('linked_account_id'):
            raise serializers.ValidationError({
                'linked_account_id': f'{contact_type} contacts should not have linked finance accounts.'
            })

        # linked_payable_account_id only for BOTH
        if attrs.get('linked_payable_account_id') and contact_type != 'BOTH':
            raise serializers.ValidationError({
                'linked_payable_account_id': 'Secondary AP account only applies to BOTH contacts.'
            })

        return attrs


class ContactAuditLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for audit trail entries."""
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = ContactAuditLog
        fields = '__all__'
        read_only_fields = fields
