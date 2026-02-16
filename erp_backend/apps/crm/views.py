"""
CRM Module Views
ViewSets for customer/supplier contact management.
"""
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
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

    @action(detail=True, methods=['get'], url_path='summary')
    def detail_summary(self, request, pk=None):
        """Full contact summary: info + orders + payments + balance."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)

        contact = self.get_object()

        # Orders (sales or purchases depending on type)
        from apps.pos.models import Order
        from django.db.models import Sum, Count, Q
        from decimal import Decimal

        order_type = 'SALE' if contact.type == 'CUSTOMER' else 'PURCHASE'
        orders = Order.objects.filter(
            organization_id=organization_id,
            contact=contact,
            type=order_type
        ).order_by('-created_at')

        order_stats = orders.aggregate(
            total_count=Count('id'),
            total_amount=Sum('total_amount'),
            completed=Count('id', filter=Q(status__in=['COMPLETED', 'INVOICED'])),
            draft=Count('id', filter=Q(status='DRAFT')),
        )

        recent_orders = orders[:10].values(
            'id', 'ref_code', 'status', 'total_amount', 'tax_amount',
            'payment_method', 'created_at', 'invoice_number'
        )

        # Payments
        from apps.finance.payment_models import Payment
        payment_type = 'CUSTOMER_RECEIPT' if contact.type == 'CUSTOMER' else 'SUPPLIER_PAYMENT'
        payments = Payment.objects.filter(
            organization_id=organization_id,
            contact=contact,
            type=payment_type
        ).order_by('-payment_date')

        payment_stats = payments.aggregate(
            total_paid=Sum('amount'),
            payment_count=Count('id'),
        )

        recent_payments = payments[:10].values(
            'id', 'reference', 'amount', 'payment_date', 'method', 'status', 'description'
        )

        # Balance
        if contact.type == 'CUSTOMER':
            from apps.finance.payment_models import CustomerBalance
            bal_obj = CustomerBalance.objects.filter(
                organization_id=organization_id, contact=contact
            ).first()
        else:
            from apps.finance.payment_models import SupplierBalance
            bal_obj = SupplierBalance.objects.filter(
                organization_id=organization_id, contact=contact
            ).first()

        balance_data = {
            'current_balance': float(bal_obj.current_balance) if bal_obj else 0,
            'last_payment_date': str(bal_obj.last_payment_date) if bal_obj and bal_obj.last_payment_date else None,
        }

        # Journal entries via linked COA sub-account
        recent_journal = []
        if contact.linked_account:
            from apps.finance.models import JournalEntryLine
            journal_lines = JournalEntryLine.objects.filter(
                organization_id=organization_id,
                account_id=contact.linked_account
            ).select_related('journal_entry', 'account').order_by('-journal_entry__transaction_date')[:10]

            recent_journal = [{
                'id': jl.journal_entry.id,
                'date': str(jl.journal_entry.transaction_date.date()) if jl.journal_entry.transaction_date else None,
                'reference': jl.journal_entry.reference,
                'description': jl.description,
                'account': jl.account.name if jl.account else None,
                'debit': float(jl.debit),
                'credit': float(jl.credit),
            } for jl in journal_lines]

        return Response({
            'contact': ContactSerializer(contact).data,
            'orders': {
                'stats': {
                    'total_count': order_stats['total_count'] or 0,
                    'total_amount': float(order_stats['total_amount'] or 0),
                    'completed': order_stats['completed'] or 0,
                    'draft': order_stats['draft'] or 0,
                },
                'recent': list(recent_orders),
            },
            'payments': {
                'stats': {
                    'total_paid': float(payment_stats['total_paid'] or 0),
                    'payment_count': payment_stats['payment_count'] or 0,
                },
                'recent': list(recent_payments),
            },
            'balance': balance_data,
            'journal_entries': recent_journal,
        })
