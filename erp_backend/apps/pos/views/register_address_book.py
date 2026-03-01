"""
Address Book (Cashier Daily Ledger) — API Views
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full CRUD + Approval Workflow + Daily Snapshots.

Entry types: SUPPLIER_PAYMENT, EXPENSE, PARTNER_CONTRIBUTION,
PARTNER_WITHDRAWAL, CLIENT_PAYMENT, CLIENT_PREPAYMENT,
SALE_DEPOSIT, SALES_RETURN, CASH_OVERAGE, CASH_SHORTAGE,
MONEY_TRANSFER, OTHER_IN, OTHER_OUT.

Status flow: PENDING → APPROVED | REJECTED | NEED_INFO
             REJECTED/NEED_INFO → MODIFIED → PENDING (re-review)
"""
from .base import (
    viewsets, status, Response, action, get_current_tenant_id,
    Organization, User, Warehouse, timezone
)
from django.db.models import Sum, Count, Q
from decimal import Decimal
import json

from apps.pos.models import POSRegister, RegisterSession, CashierAddressBook
from apps.pos.models.register_models import DailyAddressBookSnapshot


def serialize_entry(e, running_balance=None):
    """Serialize a single CashierAddressBook entry."""
    return {
        'id': e.id,
        'entryType': e.entry_type,
        'direction': e.direction,
        'description': e.description,
        'reference': e.reference or '',
        'amountIn': float(e.amount_in),
        'amountOut': float(e.amount_out),
        'net': float(e.net),
        'runningBalance': float(running_balance) if running_balance is not None else 0,
        'status': e.status,
        'hiddenFromCashier': e.hidden_from_cashier,

        # Who
        'cashierName': f"{e.cashier.first_name} {e.cashier.last_name}".strip() if e.cashier else '',
        'cashierId': e.cashier_id,
        'approvedBy': f"{e.approved_by.first_name} {e.approved_by.last_name}".strip() if e.approved_by else None,
        'approvedAt': str(e.approved_at) if e.approved_at else None,
        'rejectionNotes': e.rejection_notes or '',
        'cashierResponse': e.cashier_response or '',

        # Linking
        'supplierId': e.supplier_id,
        'supplierName': e.supplier_name or '',
        'supplierInvoiceId': e.supplier_invoice_id,
        'supplierInvoiceRef': e.supplier_invoice_ref or '',
        'clientId': e.client_id,
        'clientName': e.client_name or '',
        'clientInvoiceId': e.client_invoice_id,
        'clientInvoiceRef': e.client_invoice_ref or '',
        'expenseCategory': e.expense_category or '',
        'partnerName': e.partner_name or '',
        'linkedOrderId': e.linked_order_id,
        'linkedOrderRef': e.linked_order_ref or '',
        'targetAccountId': e.target_account_id,

        # Timestamps
        'createdAt': str(e.created_at),
        'updatedAt': str(e.updated_at) if e.updated_at else None,
    }


class RegisterAddressBookMixin:

    # ═══════════════════════════════════════════════════════
    # LIST — Cashier Daily Ledger
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='address-book')
    def address_book_list(self, request):
        """List address book entries for a session.
        Query params:
            session_id (required)
            is_manager (optional, "true") — if true, shows hidden entries
            status_filter (optional) — filter by status
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        session_id = request.query_params.get('session_id')
        is_manager = request.query_params.get('is_manager', '').lower() == 'true'
        status_filter = request.query_params.get('status_filter', '')

        if not session_id:
            return Response({"error": "session_id required"}, status=status.HTTP_400_BAD_REQUEST)

        qs = CashierAddressBook.objects.filter(
            organization_id=org_id, session_id=session_id, is_deleted=False
        ).select_related('cashier', 'approved_by').order_by('created_at')

        # Cashiers don't see hidden entries (e.g., CASH_OVERAGE)
        if not is_manager:
            qs = qs.filter(hidden_from_cashier=False)

        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        # Calculate running balance and serialize
        running = Decimal('0.00')
        data = []
        for e in qs:
            running += e.amount_in - e.amount_out
            data.append(serialize_entry(e, running))

        total_in = sum(e['amountIn'] for e in data)
        total_out = sum(e['amountOut'] for e in data)

        # ── Per-status balances for audit ──
        pending_entries = [e for e in data if e['status'] in ('PENDING', 'MODIFIED')]
        approved_entries = [e for e in data if e['status'] == 'APPROVED']
        rejected_entries = [e for e in data if e['status'] == 'REJECTED']
        need_info_entries = [e for e in data if e['status'] == 'NEED_INFO']

        pending_in = sum(e['amountIn'] for e in pending_entries)
        pending_out = sum(e['amountOut'] for e in pending_entries)
        approved_in = sum(e['amountIn'] for e in approved_entries)
        approved_out = sum(e['amountOut'] for e in approved_entries)

        return Response({
            'entries': data,
            'summary': {
                # Overall totals
                'totalIn': total_in,
                'totalOut': total_out,
                'netBalance': total_in - total_out,

                # ── NOT YET POSTED (Pending + Modified) ──
                'pendingIn': pending_in,
                'pendingOut': pending_out,
                'pendingBalance': pending_in - pending_out,

                # ── ALREADY POSTED (Approved) ──
                'approvedIn': approved_in,
                'approvedOut': approved_out,
                'approvedBalance': approved_in - approved_out,

                # Counts
                'pendingCount': len(pending_entries),
                'approvedCount': len(approved_entries),
                'rejectedCount': len(rejected_entries),
                'needInfoCount': len(need_info_entries),
                'totalCount': len(data),
            },
            'entryTypes': [
                {'key': k, 'label': v} for k, v in CashierAddressBook.ENTRY_TYPE_CHOICES
            ],
        })


    # ═══════════════════════════════════════════════════════
    # ADD — Create new entry
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['post'], url_path='address-book/add')
    def address_book_add(self, request):
        """Add a new address book entry.
        Body: {
            session_id, entry_type, description,
            amount_in?, amount_out?, reference?,
            supplier_id?, supplier_name?, supplier_invoice_id?, supplier_invoice_ref?,
            client_id?, client_name?, client_invoice_id?, client_invoice_ref?,
            expense_category?, partner_name?,
            linked_order_id?, linked_order_ref?,
            target_account_id?, cashier_id?
        }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        session_id = request.data.get('session_id')
        entry_type = request.data.get('entry_type', 'OTHER_IN')
        description = request.data.get('description', '').strip()
        reference = request.data.get('reference', '').strip()
        amount_in = Decimal(str(request.data.get('amount_in', 0)))
        amount_out = Decimal(str(request.data.get('amount_out', 0)))
        cashier_id = request.data.get('cashier_id')

        if not session_id or not description:
            return Response({"error": "session_id and description required"}, status=status.HTTP_400_BAD_REQUEST)

        if amount_in == 0 and amount_out == 0:
            return Response({"error": "Amount must be > 0"}, status=status.HTTP_400_BAD_REQUEST)

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
            entry_type=entry_type,
            description=description,
            reference=reference,
            amount_in=amount_in,
            amount_out=amount_out,
            # Linking fields
            supplier_id=request.data.get('supplier_id'),
            supplier_name=request.data.get('supplier_name', ''),
            supplier_invoice_id=request.data.get('supplier_invoice_id'),
            supplier_invoice_ref=request.data.get('supplier_invoice_ref', ''),
            client_id=request.data.get('client_id'),
            client_name=request.data.get('client_name', ''),
            client_invoice_id=request.data.get('client_invoice_id'),
            client_invoice_ref=request.data.get('client_invoice_ref', ''),
            expense_category=request.data.get('expense_category', ''),
            partner_id=request.data.get('partner_id'),
            partner_name=request.data.get('partner_name', ''),
            linked_order_id=request.data.get('linked_order_id'),
            linked_order_ref=request.data.get('linked_order_ref', ''),
            target_account_id=request.data.get('target_account_id'),
            status='PENDING',  # model.save() may override for CASH_OVERAGE
        )

        return Response({
            'id': entry.id,
            'message': f'Entry added: {description}',
            'status': entry.status,
            'entryType': entry.entry_type,
            'direction': entry.direction,
        }, status=status.HTTP_201_CREATED)


    # ═══════════════════════════════════════════════════════
    # REVIEW — Approve / Reject / Need Info
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['post'], url_path='address-book/review')
    def address_book_review(self, request):
        """Manager reviews an address book entry.
        Body: {
            entry_id,
            action: 'approve' | 'reject' | 'need_info',
            notes?,
            manager_id?
        }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        entry_id = request.data.get('entry_id')
        review_action = request.data.get('action', '').lower()
        notes = request.data.get('notes', '')
        manager_id = request.data.get('manager_id')

        valid_actions = ('approve', 'reject', 'need_info')
        if review_action not in valid_actions:
            return Response({"error": f"action must be one of: {valid_actions}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entry = CashierAddressBook.objects.get(id=entry_id, organization_id=org_id, is_deleted=False)
        except CashierAddressBook.DoesNotExist:
            return Response({"error": "Entry not found"}, status=status.HTTP_404_NOT_FOUND)

        manager = None
        if manager_id:
            try:
                manager = User.objects.get(id=manager_id, organization_id=org_id)
            except User.DoesNotExist:
                pass

        reviewer = manager or (request.user if not request.user.is_anonymous else None)

        if review_action == 'approve':
            entry.status = 'APPROVED'
            entry.approved_by = reviewer
            entry.approved_at = timezone.now()
            entry.hidden_from_cashier = True  # Approved entries become hidden
            entry.save()

            # ── Auto-execute the real ERP action ──
            execution_result = None
            execution_error = None
            try:
                from apps.pos.services.address_book_executor import AddressBookExecutor
                execution_result = AddressBookExecutor.execute(entry, manager=reviewer)
            except Exception as e:
                execution_error = str(e)
                import logging
                logging.getLogger(__name__).error(f"AddressBook #{entry.id} auto-execution failed: {e}", exc_info=True)

            msg = f'Entry "{entry.description}" approved'
            if execution_result:
                msg += f' — transaction posted to ledger'
            elif execution_error:
                msg += f' — ⚠ ledger posting failed: {execution_error}'

            return Response({
                'message': msg,
                'status': 'APPROVED',
                'executed': execution_result is not None,
                'executionError': execution_error,
            })

        elif review_action == 'reject':
            entry.status = 'REJECTED'
            entry.approved_by = reviewer
            entry.approved_at = timezone.now()
            entry.rejection_notes = notes
            entry.save()
            return Response({'message': f'Entry "{entry.description}" rejected', 'status': 'REJECTED'})

        elif review_action == 'need_info':
            entry.status = 'NEED_INFO'
            entry.approved_by = reviewer
            entry.rejection_notes = notes
            entry.save()
            return Response({'message': f'Info requested for "{entry.description}"', 'status': 'NEED_INFO'})


    # ═══════════════════════════════════════════════════════
    # RESPOND — Cashier responds to rejection / info request
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['post'], url_path='address-book/respond')
    def address_book_respond(self, request):
        """Cashier responds to a rejected/need-info entry and resubmits.
        Body: {
            entry_id,
            response: string,
            updated_description?,
            updated_amount_in?,
            updated_amount_out?,
            updated_entry_type?
        }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        entry_id = request.data.get('entry_id')
        response_text = request.data.get('response', '').strip()

        try:
            entry = CashierAddressBook.objects.get(id=entry_id, organization_id=org_id, is_deleted=False)
        except CashierAddressBook.DoesNotExist:
            return Response({"error": "Entry not found"}, status=status.HTTP_404_NOT_FOUND)

        if entry.status not in ('REJECTED', 'NEED_INFO'):
            return Response({"error": "Can only respond to REJECTED or NEED_INFO entries"}, status=status.HTTP_400_BAD_REQUEST)

        entry.cashier_response = response_text
        entry.status = 'MODIFIED'

        # Allow updating fields on resubmit
        if request.data.get('updated_description'):
            entry.description = request.data['updated_description']
        if request.data.get('updated_amount_in') is not None:
            entry.amount_in = Decimal(str(request.data['updated_amount_in']))
        if request.data.get('updated_amount_out') is not None:
            entry.amount_out = Decimal(str(request.data['updated_amount_out']))
        if request.data.get('updated_entry_type'):
            entry.entry_type = request.data['updated_entry_type']

        # Update optional linking fields if provided
        for field in ['supplier_id', 'supplier_name', 'supplier_invoice_id', 'supplier_invoice_ref',
                      'client_id', 'client_name', 'client_invoice_id', 'client_invoice_ref',
                      'expense_category', 'partner_name', 'linked_order_id', 'linked_order_ref',
                      'target_account_id']:
            if field in request.data:
                setattr(entry, field, request.data[field])

        entry.save()

        # Auto-transition MODIFIED → PENDING for re-review
        entry.status = 'PENDING'
        entry.approved_by = None
        entry.approved_at = None
        entry.save(update_fields=['status', 'approved_by', 'approved_at'])

        return Response({
            'message': f'Entry "{entry.description}" resubmitted for review',
            'status': 'PENDING',
        })


    # ═══════════════════════════════════════════════════════
    # DELETE — Soft-delete (PIN required for manager)
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['post'], url_path='address-book/delete')
    def address_book_delete(self, request):
        """Soft-delete an address book entry.
        Body: { entry_id, manager_id? }
        Non-approved entries only. Keeps audit trail.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        entry_id = request.data.get('entry_id')
        try:
            entry = CashierAddressBook.objects.get(id=entry_id, organization_id=org_id, is_deleted=False)
        except CashierAddressBook.DoesNotExist:
            return Response({"error": "Entry not found"}, status=status.HTTP_404_NOT_FOUND)

        if entry.status == 'APPROVED':
            return Response({"error": "Cannot delete APPROVED entries (immutable)"}, status=status.HTTP_400_BAD_REQUEST)

        entry.is_deleted = True
        entry.deleted_by = request.user if not request.user.is_anonymous else None
        entry.deleted_at = timezone.now()
        entry.save(update_fields=['is_deleted', 'deleted_by', 'deleted_at'])

        return Response({'message': f'Entry "{entry.description}" deleted'})


    # ═══════════════════════════════════════════════════════
    # SNAPSHOT — Create daily snapshot
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['post'], url_path='address-book/snapshot')
    def address_book_snapshot(self, request):
        """Create an immutable daily snapshot of the address book.
        Body: { session_id }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        session_id = request.data.get('session_id')
        try:
            session = RegisterSession.objects.select_related('register').get(
                id=session_id, organization_id=org_id
            )
        except RegisterSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        entries = CashierAddressBook.objects.filter(
            organization_id=org_id, session_id=session_id, is_deleted=False
        ).select_related('cashier', 'approved_by').order_by('created_at')

        running = Decimal('0.00')
        entries_data = []
        for e in entries:
            running += e.amount_in - e.amount_out
            entries_data.append(serialize_entry(e, running))

        total_in = sum(e['amountIn'] for e in entries_data)
        total_out = sum(e['amountOut'] for e in entries_data)
        today = timezone.now().date()

        snapshot, created = DailyAddressBookSnapshot.objects.update_or_create(
            organization_id=org_id,
            session=session,
            date=today,
            defaults={
                'register': session.register,
                'cashier': session.cashier,
                'total_in': Decimal(str(total_in)),
                'total_out': Decimal(str(total_out)),
                'balance': Decimal(str(total_in - total_out)),
                'pending_count': sum(1 for e in entries_data if e['status'] == 'PENDING'),
                'approved_count': sum(1 for e in entries_data if e['status'] == 'APPROVED'),
                'rejected_count': sum(1 for e in entries_data if e['status'] == 'REJECTED'),
                'entries_json': entries_data,
            }
        )

        return Response({
            'id': snapshot.id,
            'date': str(snapshot.date),
            'created': created,
            'totalIn': float(snapshot.total_in),
            'totalOut': float(snapshot.total_out),
            'balance': float(snapshot.balance),
            'entryCount': len(entries_data),
        })


    # ═══════════════════════════════════════════════════════
    # SEARCH CONTACTS — For supplier/client selection
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='address-book/search-contacts')
    def address_book_search_contacts(self, request):
        """Search suppliers or clients for Address Book linking.
        Query params:
            q (search term)
            type: 'SUPPLIER' | 'CUSTOMER' | 'ALL' (default: ALL)
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        q = request.query_params.get('q', '').strip()
        contact_type = request.query_params.get('type', 'ALL').upper()

        try:
            from apps.crm.models import Contact
            qs = Contact.objects.filter(organization_id=org_id)

            if contact_type == 'SUPPLIER':
                qs = qs.filter(type='SUPPLIER')
            elif contact_type == 'CUSTOMER':
                qs = qs.filter(type='CUSTOMER')
            elif contact_type == 'PARTNER':
                qs = qs.filter(type='PARTNER')
            # ALL = no filter

            if q:
                qs = qs.filter(
                    Q(name__icontains=q) |
                    Q(phone__icontains=q) |
                    Q(email__icontains=q) |
                    Q(company_name__icontains=q)
                )

            contacts = qs.order_by('name')[:30]
            return Response([{
                'id': c.id,
                'name': c.name or c.company_name or f'Contact #{c.id}',
                'phone': c.phone or '',
                'type': c.type,
                'balance': float(getattr(c, 'current_balance', 0) or 0),
            } for c in contacts])

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    # ═══════════════════════════════════════════════════════
    # UNPAID INVOICES — For invoice linking
    # ═══════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='address-book/unpaid-invoices')
    def address_book_unpaid_invoices(self, request):
        """Get unpaid invoices for a specific contact.
        Query params:
            contact_id (required)
            type: 'PURCHASE' | 'SALES' (optional, filters invoice type)
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        contact_id = request.query_params.get('contact_id')
        invoice_type = request.query_params.get('type', '').upper()

        if not contact_id:
            return Response({"error": "contact_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from apps.finance.invoice_models import Invoice
            qs = Invoice.objects.filter(
                organization_id=org_id,
                contact_id=contact_id,
                status__in=['SENT', 'PARTIAL_PAID', 'OVERDUE'],
                balance_due__gt=0,
            )

            if invoice_type in ('PURCHASE', 'SALES'):
                qs = qs.filter(type=invoice_type)

            invoices = qs.order_by('-issue_date')[:50]
            return Response([{
                'id': inv.id,
                'invoiceNumber': inv.invoice_number or f'INV-{inv.id}',
                'type': inv.type,
                'status': inv.status,
                'totalAmount': float(inv.total_amount),
                'paidAmount': float(inv.paid_amount),
                'balanceDue': float(inv.balance_due),
                'issueDate': str(inv.issue_date) if inv.issue_date else '',
                'dueDate': str(inv.due_date) if inv.due_date else '',
                'contactName': inv.contact_name or '',
            } for inv in invoices])

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

