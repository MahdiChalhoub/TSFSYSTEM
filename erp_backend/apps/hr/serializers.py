"""
HR Module Serializers
"""
from rest_framework import serializers
from .models import Employee


class EmployeeSerializer(serializers.ModelSerializer):
    linked_account = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = '__all__'

    def get_linked_account(self, obj):
        if not obj.linked_account_id:
            return None
        try:
            from apps.finance.models import ChartOfAccount
            account = ChartOfAccount.objects.filter(id=obj.linked_account_id).first()
            if account:
                return {'id': account.id, 'code': account.code, 'name': account.name}
        except Exception:
            pass
        return {'id': obj.linked_account_id, 'code': '?', 'name': 'Unknown'}
