"""
HR Module Serializers
"""
from rest_framework import serializers
from .models import Employee, Department, Shift, Attendance, Leave


class EmployeeSerializer(serializers.ModelSerializer):
    linked_account = serializers.SerializerMethodField()
    dividends_account = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = '__all__'

    def _resolve_account(self, account_id):
        if not account_id:
            return None
        try:
            from apps.finance.models import ChartOfAccount
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


class DepartmentSerializer(serializers.ModelSerializer):
    manager_name = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = '__all__'

    def get_manager_name(self, obj):
        return str(obj.manager) if obj.manager else None

    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent else None


class ShiftSerializer(serializers.ModelSerializer):
    duration_hours = serializers.ReadOnlyField()

    class Meta:
        model = Shift
        fields = '__all__'


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    hours_worked = serializers.ReadOnlyField()

    class Meta:
        model = Attendance
        fields = '__all__'

    def get_employee_name(self, obj):
        return str(obj.employee) if obj.employee else None


class LeaveSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    duration_days = serializers.ReadOnlyField()

    class Meta:
        model = Leave
        fields = '__all__'

    def get_employee_name(self, obj):
        return str(obj.employee) if obj.employee else None

    def get_approved_by_name(self, obj):
        return str(obj.approved_by) if obj.approved_by else None
