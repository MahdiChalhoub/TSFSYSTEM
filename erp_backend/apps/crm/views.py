"""
CRM Module Views
ViewSets for customer/supplier contact management.
"""
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from erp.models import Organization
from erp.services import ConfigurationService

from apps.crm.models import Contact
from apps.crm.serializers import ContactSerializer
from apps.finance.models import ChartOfAccount
from apps.finance.services import LedgerService


class ContactViewSet(TenantModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        data = request.data.copy()

        with transaction.atomic():
            rules = ConfigurationService.get_posting_rules(organization)
            contact_type = data.get('type')
            
            parent_account_id = None
            if contact_type == 'CUSTOMER':
                parent_account_id = rules.get('sales', {}).get('receivable')
            else:
                parent_account_id = rules.get('purchases', {}).get('payable')
            
            if not parent_account_id:
                fallback_code = '1110' if contact_type == 'CUSTOMER' else '2101'
                parent = ChartOfAccount.objects.filter(organization=organization, code=fallback_code).first()
                if parent: parent_account_id = parent.id
            
            if parent_account_id:
                parent = ChartOfAccount.objects.get(id=parent_account_id)
                linked_acc = LedgerService.create_linked_account(
                    organization=organization,
                    name=f"{data.get('name')} ({'AR' if contact_type == 'CUSTOMER' else 'AP'})",
                    type=parent.type,
                    sub_type='RECEIVABLE' if contact_type == 'CUSTOMER' else 'PAYABLE',
                    parent_id=parent_account_id
                )
                data['linked_account'] = linked_acc.id

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
