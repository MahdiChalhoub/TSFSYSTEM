from rest_framework import serializers
from apps.pos.models import POSRegister, RegisterSession

class POSRegisterSerializer(serializers.ModelSerializer):
    site_name = serializers.ReadOnlyField(source='branch.name')
    cash_account_name = serializers.ReadOnlyField(source='cash_account.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    
    class Meta:
        model = POSRegister
        fields = [
            'id', 'name', 'branch', 'site_name', 'warehouse', 'warehouse_name',
            'cash_account', 'cash_account_name', 'allowed_accounts', 
            'authorized_users', 'is_active', 'opening_mode', 'cashier_can_see_software',
            'payment_methods', 'reserve_account'
        ]

class RegisterSessionSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source='cashier.get_full_name', read_only=True)
    register_name = serializers.CharField(source='register.name', read_only=True)
    
    class Meta:
        model = RegisterSession
        fields = '__all__'
        read_only_fields = ('organization', 'opened_at', 'closed_at', 'closed_by')
