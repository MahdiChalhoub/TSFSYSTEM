from rest_framework import serializers
from apps.finance.models import ChartOfAccount, FinancialAccount

class ChartOfAccountSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = ChartOfAccount
        fields = '__all__'

class FinancialAccountSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    ledgerAccount = serializers.SerializerMethodField()
    assignedUsers = serializers.SerializerMethodField()
    class Meta:
        model = FinancialAccount
        fields = '__all__'
    def get_ledgerAccount(self, obj):
        if obj.linked_coa:
            return {'id': obj.linked_coa.id, 'code': obj.linked_coa.code, 'name': obj.linked_coa.name, 'type': obj.linked_coa.type}
        return None
    def get_assignedUsers(self, obj):
        from erp.models import User
        users = User.objects.filter(cash_register=obj)
        return [{'id': u.id, 'name': u.get_full_name() or u.username} for u in users]
