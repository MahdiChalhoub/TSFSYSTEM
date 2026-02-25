from rest_framework import serializers
from apps.hr.models import Department, Shift, Attendance, Leave

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
