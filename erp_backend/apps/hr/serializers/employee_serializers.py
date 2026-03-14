from rest_framework import serializers
from apps.hr.models import Employee

class EmployeeSerializer(serializers.ModelSerializer):
    linked_account = serializers.SerializerMethodField()
    dividends_account = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = '__all__'

    def _resolve_account(self, account_id):
        if not account_id: return None
        try:
            from erp.connector_registry import connector
            ChartOfAccount = connector.require('finance.accounts.get_model', org_id=0, source='hr.serializer')
            if ChartOfAccount:
                account = ChartOfAccount.objects.filter(id=account_id).first()
                if account:
                    return {'id': account.id, 'code': account.code, 'name': account.name}
        except Exception:
            pass
        return {'id': account_id, 'code': '?', 'name': 'Unknown'}

    def get_linked_account(self, obj):
        return self._resolve_account(obj.linked_account_id)

    def get_dividends_account(self, obj):
        return self._resolve_account(obj.dividends_account_id)
