"""
HR Connector Service
=======================
Declares all capabilities that the HR module exposes.
"""

import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by CapabilityRegistry during auto-discovery."""

    # ─── EMPLOYEES ───────────────────────────────────────────────────

    @_cap(registry, 'hr.employees.get_detail',
          description='Get employee by ID',
          cacheable=True, cache_ttl=120)
    def get_employee_detail(org_id, employee_id=None, **kw):
        from apps.hr.models import Employee
        if not employee_id:
            return None
        try:
            e = Employee.objects.get(id=employee_id, organization_id=org_id)
            return {
                'id': e.id,
                'name': str(e),
                'employee_code': getattr(e, 'employee_code', ''),
                'department': getattr(e, 'department', ''),
                'position': getattr(e, 'position', ''),
                'is_active': getattr(e, 'is_active', True),
            }
        except Exception:
            return None

    @_cap(registry, 'hr.employees.list',
          description='List employees for an organization',
          cacheable=True, cache_ttl=60)
    def list_employees(org_id, active_only=True, limit=200, **kw):
        from apps.hr.models import Employee
        qs = Employee.objects.filter(organization_id=org_id)
        if active_only:
            qs = qs.filter(is_active=True)
        return list(qs.values(
            'id', 'first_name', 'last_name', 'employee_code',
            'department', 'position', 'is_active'
        )[:limit])

    @_cap(registry, 'hr.employees.get_model',
          description='Get Employee model class',
          cacheable=False, critical=False)
    def get_employee_model(org_id=0, **kw):
        from apps.hr.models import Employee
        return Employee

    @_cap(registry, 'hr.departments.get_model',
          description='Get Department model class',
          cacheable=False, critical=False)
    def get_department_model(org_id=0, **kw):
        from apps.hr.models import Department
        return Department


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
