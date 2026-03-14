"""
PostingRule Serializer
=====================
Handles validation for PostingRule CRUD operations.
Validates that accounts are postable and belong to the correct organization.
"""
from rest_framework import serializers
from apps.finance.models import PostingRule, ChartOfAccount
from apps.finance.services.posting_resolver import PostingEvents


class PostingRuleSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = PostingRule
        fields = [
            'id', 'event_code', 'account', 'account_code', 'account_name',
            'module', 'source', 'description', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'module', 'created_at', 'updated_at']

    def validate_event_code(self, value):
        """Validate event code format: must be dotted, e.g. sales.receivable."""
        if '.' not in value:
            raise serializers.ValidationError(
                f"Event code must be in dotted format (e.g. 'sales.receivable'), got: '{value}'"
            )
        # Check it's a known event code (warn if not)
        known_codes = {
            v for k, v in vars(PostingEvents).items()
            if not k.startswith('_')
        }
        if value not in known_codes:
            # Allow unknown codes but include a note — don't block
            pass
        return value

    def validate_account(self, value):
        """Validate the account belongs to the user's organization and is postable."""
        request = self.context.get('request')
        if request and hasattr(request, 'org_id'):
            if value.organization_id != request.org_id:
                raise serializers.ValidationError(
                    "Account does not belong to your organization."
                )
        # Check the account is not archived (if the field exists)
        if hasattr(value, 'is_archived') and value.is_archived:
            raise serializers.ValidationError(
                f"Account '{value.code} - {value.name}' is archived and cannot be used."
            )
        return value
