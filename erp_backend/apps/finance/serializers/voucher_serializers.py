from rest_framework import serializers
from apps.finance.models import Voucher

class VoucherSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    source_account_name = serializers.ReadOnlyField(source='source_account.name')
    destination_account_name = serializers.ReadOnlyField(source='destination_account.name')
    locked_by_name = serializers.CharField(source='locked_by.username', read_only=True, default=None)
    class Meta:
        model = Voucher
        fields = [
            'id', 'voucher_type', 'amount', 'date', 'reference', 'description',
            'source_account', 'source_account_name',
            'destination_account', 'destination_account_name',
            'financial_event', 'contact', 'journal_entry',
            'scope', 'is_posted',
            'lifecycle_status', 'locked_by', 'locked_by_name',
            'locked_at', 'current_verification_level',
            'created_at', 'updated_at', 'organization',
        ]
        read_only_fields = ['organization', 'reference', 'is_posted',
                            'lifecycle_status', 'locked_by', 'locked_at',
                            'current_verification_level']
