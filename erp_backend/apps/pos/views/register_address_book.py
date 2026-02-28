"""
POS Register management views.
Handles register CRUD, session open/close, PIN authentication, and lobby data.
"""
from .base import (
    viewsets, status, Response, action, get_current_tenant_id,
    Organization, User, Warehouse, timezone
)
from django.db.models import Sum, Count, Q
from decimal import Decimal

from apps.pos.models import POSRegister, RegisterSession, Order, CashierAddressBook
from apps.pos.models.register_models import SessionAccountReconciliation



class RegisterAddressBookMixin:

    # ═══════════════════════════════════════════════════════
    # ADDRESS BOOK (Cashier offline ledger)
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='address-book')
    def address_book_list(self, request):
        """List all address book entries for a session."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({"error": "session_id required"}, status=status.HTTP_400_BAD_REQUEST)

        entries = CashierAddressBook.objects.filter(
            organization_id=org_id, session_id=session_id
        ).select_related('cashier', 'approved_by').order_by('created_at')

        # Calculate running balance
        running = Decimal('0.00')
        data = []
        for e in entries:
            running += e.amount_in - e.amount_out
            data.append({
                'id': e.id,
                'description': e.description,
                'reference': e.reference or '',
                'amountIn': float(e.amount_in),
                'amountOut': float(e.amount_out),
                'net': float(e.net),
                'runningBalance': float(running),
                'status': e.status,
                'cashierName': f"{e.cashier.first_name} {e.cashier.last_name}".strip() if e.cashier else '',
                'cashierId': e.cashier_id,
                'approvedBy': f"{e.approved_by.first_name} {e.approved_by.last_name}".strip() if e.approved_by else None,
                'approvedAt': str(e.approved_at) if e.approved_at else None,
                'rejectionNotes': e.rejection_notes or '',
                'createdAt': str(e.created_at),
            })

        total_in = sum(e['amountIn'] for e in data)
        total_out = sum(e['amountOut'] for e in data)
        approved_balance = sum(e['net'] for e in data if e['status'] == 'APPROVED')

        return Response({
            'entries': data,
            'summary': {
                'totalIn': total_in,
                'totalOut': total_out,
                'netBalance': total_in - total_out,
                'approvedBalance': float(approved_balance),
                'pendingCount': sum(1 for e in data if e['status'] == 'PENDING'),
                'approvedCount': sum(1 for e in data if e['status'] == 'APPROVED'),
                'rejectedCount': sum(1 for e in data if e['status'] == 'REJECTED'),
            }
        })


    @action(detail=False, methods=['post'], url_path='address-book/add')
    def address_book_add(self, request):
        """Add a new address book entry (starts as PENDING)."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        session_id = request.data.get('session_id')
        description = request.data.get('description', '').strip()
        reference = request.data.get('reference', '').strip()
        amount_in = Decimal(str(request.data.get('amount_in', 0)))
        amount_out = Decimal(str(request.data.get('amount_out', 0)))
        cashier_id = request.data.get('cashier_id')

        if not session_id or not description:
            return Response({"error": "session_id and description required"}, status=status.HTTP_400_BAD_REQUEST)

        if amount_in == 0 and amount_out == 0:
            return Response({"error": "At least one of amount_in or amount_out must be > 0"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = RegisterSession.objects.get(id=session_id, organization_id=org_id, status='OPEN')
        except RegisterSession.DoesNotExist:
            return Response({"error": "Open session not found"}, status=status.HTTP_404_NOT_FOUND)

        cashier = None
        if cashier_id:
            try:
                cashier = User.objects.get(id=cashier_id, organization_id=org_id)
            except User.DoesNotExist:
                pass

        entry = CashierAddressBook.objects.create(
            organization_id=org_id,
            session=session,
            cashier=cashier or (request.user if not request.user.is_anonymous else session.cashier),
            description=description,
            reference=reference,
            amount_in=amount_in,
            amount_out=amount_out,
            status='PENDING',
        )

        return Response({
            'id': entry.id,
            'message': f'Entry added: {description}',
            'status': 'PENDING',
        }, status=status.HTTP_201_CREATED)


    @action(detail=False, methods=['post'], url_path='address-book/review')
    def address_book_review(self, request):
        """
        Manager approves or rejects an address book entry.
        Expects: { entry_id, action: 'approve'|'reject', notes?, manager_id? }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        entry_id = request.data.get('entry_id')
        review_action = request.data.get('action', '').lower()
        notes = request.data.get('notes', '')
        manager_id = request.data.get('manager_id')

        if review_action not in ('approve', 'reject'):
            return Response({"error": "action must be 'approve' or 'reject'"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entry = CashierAddressBook.objects.get(id=entry_id, organization_id=org_id)
        except CashierAddressBook.DoesNotExist:
            return Response({"error": "Entry not found"}, status=status.HTTP_404_NOT_FOUND)

        manager = None
        if manager_id:
            try:
                manager = User.objects.get(id=manager_id, organization_id=org_id)
            except User.DoesNotExist:
                pass

        if review_action == 'approve':
            entry.status = 'APPROVED'
            entry.approved_by = manager or (request.user if not request.user.is_anonymous else None)
            entry.approved_at = timezone.now()
            entry.save()
            return Response({'message': f'Entry "{entry.description}" approved', 'status': 'APPROVED'})
        else:
            entry.status = 'REJECTED'
            entry.approved_by = manager or (request.user if not request.user.is_anonymous else None)
            entry.approved_at = timezone.now()
            entry.rejection_notes = notes
            entry.save()
            return Response({'message': f'Entry "{entry.description}" rejected', 'status': 'REJECTED'})


    @action(detail=False, methods=['post'], url_path='address-book/delete')
    def address_book_delete(self, request):
        """Delete an address book entry (only if PENDING)."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        entry_id = request.data.get('entry_id')
        try:
            entry = CashierAddressBook.objects.get(id=entry_id, organization_id=org_id)
        except CashierAddressBook.DoesNotExist:
            return Response({"error": "Entry not found"}, status=status.HTTP_404_NOT_FOUND)

        if entry.status != 'PENDING':
            return Response({"error": "Can only delete PENDING entries"}, status=status.HTTP_400_BAD_REQUEST)

        entry.delete()
        return Response({'message': 'Entry deleted'})

