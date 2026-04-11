from decimal import Decimal
from rest_framework import serializers
from apps.finance.models import OrgTaxPolicy, CounterpartyTaxProfile, CustomTaxRule, TaxJurisdictionRule


class OrgTaxPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgTaxPolicy
        fields = [
            'id', 'name', 'is_default',
            'country_code', 'currency_code',
            'vat_output_enabled', 'vat_input_recoverability',
            'official_vat_treatment', 'internal_vat_treatment',
            'airsi_treatment',
            'purchase_tax_rate', 'purchase_tax_mode',
            'sales_tax_rate', 'sales_tax_trigger',
            'periodic_amount', 'periodic_interval',
            'profit_tax_mode',
            'allowed_scopes', 'internal_cost_mode',
            'internal_sales_vat_mode',
            # Tax Account Links
            'vat_collected_account', 'vat_recoverable_account',
            'vat_payable_account', 'vat_refund_receivable_account',
            'vat_suspense_account', 'airsi_account', 'reverse_charge_account',
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
            'id', 'name', 'country_code', 'state_code',
            'vat_registered', 'reverse_charge', 'airsi_subject',
            'allowed_scopes', 'required_documents', 'enforce_compliance',
            'is_system_preset',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_system_preset', 'created_at', 'updated_at']


class CustomTaxRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomTaxRule
        fields = [
            'id', 'name', 'rate', 'transaction_type', 'math_behavior', 
            'purchase_cost_treatment',
            'tax_base_mode', 'base_tax_type', 'calculation_order', 'compound_group',
            'liability_account', 'expense_account', 
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        base_mode = data.get('tax_base_mode', 'HT')
        base_tax_type = data.get('base_tax_type')

        if base_mode == 'PREVIOUS_TAX' and not base_tax_type:
            raise serializers.ValidationError({
                'base_tax_type': 'Required when tax_base_mode is PREVIOUS_TAX. '
                                 'Specify which tax type to use as base (e.g. VAT, AIRSI).'
            })
        if base_mode != 'PREVIOUS_TAX' and base_tax_type:
            raise serializers.ValidationError({
                'base_tax_type': 'Must be null when tax_base_mode is not PREVIOUS_TAX.'
            })

        calc_order = data.get('calculation_order', 100)
        if calc_order < 0:
            raise serializers.ValidationError({
                'calculation_order': 'Must be a non-negative integer.'
            })

        return data


class TaxJurisdictionRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxJurisdictionRule
        fields = [
            'id', 'name', 'country_code', 'region_code', 'tax_type',
            'rate', 'place_of_supply_mode',
            'reverse_charge_allowed', 'zero_rate_export',
            'registration_threshold', 'priority',
            'is_active', 'is_system_preset',
            'effective_from', 'effective_to',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_system_preset', 'created_at', 'updated_at']
