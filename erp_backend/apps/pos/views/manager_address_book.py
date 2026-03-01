from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Sum, Q

from erp.views import TenantModelViewSet
from apps.pos.models import CashierAddressBook, DailyAddressBookSnapshot
from apps.pos.views.register_address_book import serialize_entry

class ManagerAddressBookViewSet(TenantModelViewSet):
    """
    Central Manager Dashboard for the Account Book.
    Allows managers to see entries across all registers, bulk approve,
    and view daily snapshots.
    """
    queryset = CashierAddressBook.objects.all()

    @action(detail=False, methods=['get'], url_path='all-entries')
    def all_entries(self, request):
        org = request.user.organization
        if not org:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        status_filter = request.query_params.get('status', '')
        register_id = request.query_params.get('register_id', '')
        date_filter = request.query_params.get('date', '')

        qs = CashierAddressBook.objects.filter(
            organization=org, is_deleted=False
        ).select_related('cashier', 'approved_by', 'session__register')

        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        if register_id:
            qs = qs.filter(session__register_id=register_id)
        if date_filter:
            qs = qs.filter(created_at__date=date_filter)

        qs = qs.order_by('-created_at')[:200]

        data = []
        for e in qs:
            entry_data = serialize_entry(e)
            entry_data['registerName'] = e.session.register.name if e.session and e.session.register else 'Unknown'
            data.append(entry_data)

        # Summary for PENDING specifically
        pending_qs = CashierAddressBook.objects.filter(
            organization=org, is_deleted=False, status__in=['PENDING', 'MODIFIED']
        )
        if register_id:
            pending_qs = pending_qs.filter(session__register_id=register_id)
            
        pending_in = pending_qs.filter(direction='IN').aggregate(Sum('amount_in'))['amount_in__sum'] or 0
        pending_out = pending_qs.filter(direction='OUT').aggregate(Sum('amount_out'))['amount_out__sum'] or 0

        return Response({
            'entries': data,
            'summary': {
                'pendingCount': pending_qs.count(),
                'pendingIn': float(pending_in),
                'pendingOut': float(pending_out),
            }
        })

    @action(detail=False, methods=['get'], url_path='snapshots')
    def list_snapshots(self, request):
        org = request.user.organization
        if not org:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
            
        qs = DailyAddressBookSnapshot.objects.filter(
            organization=org
        ).select_related('register', 'cashier').order_by('-date', '-created_at')[:50]
        
        data = [{
            'id': s.id,
            'date': str(s.date),
            'registerName': s.register.name if s.register else '',
            'cashierName': f"{s.cashier.first_name} {s.cashier.last_name}".strip() if s.cashier else '',
            'totalIn': float(s.total_in),
            'totalOut': float(s.total_out),
            'balance': float(s.balance),
            'approvedCount': s.approved_count,
            'pendingCount': s.pending_count,
            'rejectedCount': s.rejected_count,
        } for s in qs]
        
        return Response(data)
