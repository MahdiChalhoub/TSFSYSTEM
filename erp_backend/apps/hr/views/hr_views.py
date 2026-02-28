from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from apps.hr.models import Department, Shift, Attendance, Leave, Employee
from apps.hr.serializers import DepartmentSerializer, ShiftSerializer, AttendanceSerializer, LeaveSerializer

class DepartmentViewSet(TenantModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    @action(detail=False, methods=['get'], url_path='tree')
    def tree(self, request):
        depts = self.get_queryset().select_related('manager', 'parent')
        data = [{
            'id': str(d.id), 'name': d.name, 'code': d.code,
            'parent_id': str(d.parent_id) if d.parent_id else None,
            'manager_name': str(d.manager) if d.manager else None,
            'is_active': d.is_active,
        } for d in depts]
        return Response(data)

class ShiftViewSet(TenantModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer

class AttendanceViewSet(TenantModelViewSet):
    queryset = Attendance.objects.all().select_related('employee', 'shift')
    serializer_class = AttendanceSerializer

    def _validate_employee_ownership(self, data, org_id):
        employee = data.get('employee')
        if employee and hasattr(employee, 'organization_id') and employee.organization_id != org_id:
            raise ValidationError("Cross-tenant employee assignment blocked.")

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        self._validate_employee_ownership(serializer.validated_data, org_id)
        serializer.save(organization_id=org_id)

    def perform_update(self, serializer):
        org_id = get_current_tenant_id()
        self._validate_employee_ownership(serializer.validated_data, org_id)
        serializer.save()

    @action(detail=True, methods=['post'], url_path='check-in')
    def check_in(self, request, pk=None):
        from django.utils import timezone
        record = self.get_object()
        record.check_in = timezone.now()
        record.status = 'PRESENT'
        record.save(update_fields=['check_in', 'status'])
        return Response({"message": "Checked in", "check_in": record.check_in.isoformat()})
    @action(detail=True, methods=['post'], url_path='check-out')
    def check_out(self, request, pk=None):
        from django.utils import timezone
        record = self.get_object()
        record.check_out = timezone.now()
        record.save(update_fields=['check_out'])
        return Response({"message": "Checked out", "check_out": record.check_out.isoformat(), "hours_worked": record.hours_worked})

class LeaveViewSet(TenantModelViewSet):
    queryset = Leave.objects.all().select_related('employee', 'approved_by')
    serializer_class = LeaveSerializer

    def _validate_employee_ownership(self, data, org_id):
        employee = data.get('employee')
        if employee and hasattr(employee, 'organization_id') and employee.organization_id != org_id:
            raise ValidationError("Cross-tenant employee assignment blocked.")

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        self._validate_employee_ownership(serializer.validated_data, org_id)
        serializer.save(organization_id=org_id)

    def perform_update(self, serializer):
        org_id = get_current_tenant_id()
        self._validate_employee_ownership(serializer.validated_data, org_id)
        serializer.save()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        leave = self.get_object()
        if leave.status != 'PENDING': return Response({"error": "Only pending leaves can be approved"}, status=400)
        leave.approve(request.user)
        return Response({"message": f"Leave approved for {leave.employee}"})
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        leave = self.get_object()
        if leave.status != 'PENDING': return Response({"error": "Only pending leaves can be rejected"}, status=400)
        leave.reject(request.user)
        return Response({"message": f"Leave rejected for {leave.employee}"})
