from decimal import Decimal
from rest_framework import serializers
from apps.finance.models import OrgTaxPolicy, CounterpartyTaxProfile, CustomTaxRule


class OrgTaxPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgTaxPolicy
        fields = [
            'id', 'name', 'is_default',
            'country_code', 'currency_code',
            'vat_output_enabled', 'vat_input_recoverability',
            'airsi_treatment',
            'purchase_tax_rate', 'purchase_tax_mode',
            'sales_tax_rate', 'sales_tax_trigger',
            'periodic_amount', 'periodic_interval',
            'profit_tax_mode',
            'allowed_scopes', 'internal_cost_mode',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_vat_input_recoverability(self, value):
        if not (Decimal('0') <= value <= Decimal('1')):
            raise serializers.ValidationError(
                'vat_input_recoverability must be between 0.000 and 1.000'
            )
        return value

    def validate_allowed_scopes(self, value):
        valid = {'OFFICIAL', 'INTERNAL'}
        bad = [s for s in value if s not in valid]
        if bad:
            raise serializers.ValidationError(f'Invalid scopes: {bad}. Allowed: {valid}')
        return value


class CounterpartyTaxProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CounterpartyTaxProfile
        fields = [
            'id', 'name', 'country_code',
            'vat_registered', 'reverse_charge', 'airsi_subject',
            'allowed_scopes', 'is_system_preset',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_system_preset', 'created_at', 'updated_at']


class CustomTaxRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomTaxRule
        fields = [
            'id', 'name', 'rate', 'transaction_type', 'math_behavior', 
            'purchase_cost_treatment', 'liability_account', 'expense_account', 
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
