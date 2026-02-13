"""
HR Module Views
ViewSets for employee management.
"""
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from erp.models import Organization
from erp.services import ConfigurationService
import logging

logger = logging.getLogger(__name__)

from apps.hr.models import Employee
from apps.hr.serializers import EmployeeSerializer

# Gated cross-module imports
try:
    from apps.finance.models import ChartOfAccount
except ImportError:
    ChartOfAccount = None

try:
    from apps.finance.services import LedgerService
except ImportError:
    LedgerService = None


class EmployeeViewSet(TenantModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        data = request.data.copy()
        data['organization'] = organization.id

        emp_type = data.get('employee_type', 'EMPLOYEE')

        with transaction.atomic():
            # Finance integration (gated — HR works without Finance)
            if ChartOfAccount and LedgerService:
                fullName = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()

                # ── Payroll liability (EMPLOYEE or BOTH) ──
                if emp_type in ('EMPLOYEE', 'BOTH'):
                    parent = ChartOfAccount.objects.filter(organization=organization, code='2121').first()
                    if not parent:
                        parent = ChartOfAccount.objects.filter(organization=organization, code='2100').first()
                    if not parent:
                        parent = ChartOfAccount.objects.create(
                            organization=organization, code='2121',
                            name='Salaries Payable', type='LIABILITY', sub_type='PAYABLE'
                        )
                    linked_acc = LedgerService.create_linked_account(
                        organization=organization,
                        name=f"Payable — {fullName}",
                        type='LIABILITY', sub_type='PAYABLE',
                        parent_id=parent.id
                    )
                    data['linked_account_id'] = linked_acc.id

                # ── Capital equity (PARTNER or BOTH) ──
                if emp_type in ('PARTNER', 'BOTH'):
                    cap_parent = ChartOfAccount.objects.filter(organization=organization, code='3001').first()
                    if not cap_parent:
                        cap_parent = ChartOfAccount.objects.filter(organization=organization, code='3000').first()
                    if not cap_parent:
                        cap_parent = ChartOfAccount.objects.create(
                            organization=organization, code='3001',
                            name='Capital', type='EQUITY', sub_type=None
                        )
                    capital_acc = LedgerService.create_linked_account(
                        organization=organization,
                        name=f"Capital — {fullName}",
                        type='EQUITY', sub_type=None,
                        parent_id=cap_parent.id
                    )
                    # For partner-only, capital is the main linked account
                    if emp_type == 'PARTNER':
                        data['linked_account_id'] = capital_acc.id

                    # Dividends account
                    div_parent = ChartOfAccount.objects.filter(organization=organization, code='3200').first()
                    if not div_parent:
                        div_parent = ChartOfAccount.objects.filter(organization=organization, code='3000').first()
                    if not div_parent:
                        div_parent = ChartOfAccount.objects.create(
                            organization=organization, code='3200',
                            name='Dividends', type='EQUITY', sub_type=None
                        )
                    dividends_acc = LedgerService.create_linked_account(
                        organization=organization,
                        name=f"Dividends — {fullName}",
                        type='EQUITY', sub_type=None,
                        parent_id=div_parent.id
                    )
                    data['dividends_account_id'] = dividends_acc.id
            else:
                logger.warning("Finance module unavailable — employee created without linked ledger account")

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=['post'], url_path='link-gl-account')
    def link_gl_account(self, request, pk=None):
        """Auto-create and link GL sub-accounts based on employee type.
        
        EMPLOYEE → payroll liability under 2121 Salaries Payable
        PARTNER  → capital under 3001 + dividends payable under 3200
        BOTH     → all three accounts (payroll + capital + dividends)
        
        Optional body: { "employee_type": "EMPLOYEE"|"PARTNER"|"BOTH" }
        """
        employee = self.get_object()

        # Optionally update employee_type from request
        new_type = request.data.get('employee_type')
        if new_type and new_type in ('EMPLOYEE', 'PARTNER', 'BOTH'):
            employee.employee_type = new_type
            employee.save(update_fields=['employee_type'])

        if employee.linked_account_id:
            return Response({"error": "Employee already has a linked GL account", "linked_account_id": employee.linked_account_id},
                            status=status.HTTP_400_BAD_REQUEST)

        if not ChartOfAccount or not LedgerService:
            return Response({"error": "Finance module not available"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        emp_type = employee.employee_type or 'EMPLOYEE'
        full_name = str(employee)
        result = {"linked_account_id": None, "dividends_account_id": None}

        with transaction.atomic():
            # ── Payroll liability (EMPLOYEE or BOTH) ──
            if emp_type in ('EMPLOYEE', 'BOTH'):
                parent = ChartOfAccount.objects.filter(organization=organization, code='2121').first()
                if not parent:
                    parent = ChartOfAccount.objects.filter(organization=organization, code='2100').first()
                if not parent:
                    parent = ChartOfAccount.objects.create(
                        organization=organization, code='2121',
                        name='Salaries Payable', type='LIABILITY', sub_type='PAYABLE'
                    )
                linked_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"Payable — {full_name}",
                    type='LIABILITY', sub_type='PAYABLE',
                    parent_id=parent.id
                )
                employee.linked_account_id = linked_acc.id
                result["linked_account_id"] = linked_acc.id
                result["linked_account_code"] = linked_acc.code
                result["linked_account_name"] = linked_acc.name

            # ── Capital equity (PARTNER or BOTH) ──
            if emp_type in ('PARTNER', 'BOTH'):
                # Capital account
                cap_parent = ChartOfAccount.objects.filter(organization=organization, code='3001').first()
                if not cap_parent:
                    cap_parent = ChartOfAccount.objects.filter(organization=organization, code='3000').first()
                if not cap_parent:
                    cap_parent = ChartOfAccount.objects.create(
                        organization=organization, code='3001',
                        name='Capital', type='EQUITY', sub_type=None
                    )
                capital_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"Capital — {full_name}",
                    type='EQUITY', sub_type=None,
                    parent_id=cap_parent.id
                )
                # For PARTNER-only, use capital as the main linked account
                if emp_type == 'PARTNER':
                    employee.linked_account_id = capital_acc.id
                    result["linked_account_id"] = capital_acc.id
                    result["linked_account_code"] = capital_acc.code
                    result["linked_account_name"] = capital_acc.name

                # Dividends payable account
                div_parent = ChartOfAccount.objects.filter(organization=organization, code='3200').first()
                if not div_parent:
                    div_parent = ChartOfAccount.objects.filter(organization=organization, code='3000').first()
                if not div_parent:
                    div_parent = ChartOfAccount.objects.create(
                        organization=organization, code='3200',
                        name='Dividends', type='EQUITY', sub_type=None
                    )
                dividends_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"Dividends — {full_name}",
                    type='EQUITY', sub_type=None,
                    parent_id=div_parent.id
                )
                employee.dividends_account_id = dividends_acc.id
                result["dividends_account_id"] = dividends_acc.id
                result["dividends_account_code"] = dividends_acc.code
                result["dividends_account_name"] = dividends_acc.name

            employee.save(update_fields=['linked_account_id', 'dividends_account_id'])

        return Response({
            "message": f"GL accounts linked for {full_name} ({emp_type})",
            **result
        })

