"""
HR Module Views
ViewSets for employee management.
"""
from django.db import transaction
from rest_framework import status
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

        with transaction.atomic():
            # Finance integration (gated — HR works without Finance)
            if ChartOfAccount and LedgerService:
                rules = ConfigurationService.get_posting_rules(organization)
                parent_account_id = rules.get('payroll', {}).get('root')
                
                if not parent_account_id:
                    parent = ChartOfAccount.objects.filter(organization=organization, code='2200').first()
                    if not parent:
                        parent = ChartOfAccount.objects.create(
                            organization=organization,
                            code='2200',
                            name='Accrued Payroll & Salaries',
                            type='LIABILITY',
                            sub_type='PAYABLE'
                        )
                    parent_account_id = parent.id

                fullName = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
                linked_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"Payable to {fullName}",
                    type='LIABILITY',
                    sub_type='PAYABLE',
                    parent_id=parent_account_id
                )
                data['linked_account'] = linked_acc.id
            else:
                logger.warning("Finance module unavailable — employee created without linked ledger account")

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)

