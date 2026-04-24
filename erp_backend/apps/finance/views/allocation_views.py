"""Payment-allocation workbench — unallocated payments + unpaid invoices
in one view, with auto-match suggestions."""
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.middleware import get_current_tenant_id


class AllocationWorkbenchViewSet(viewsets.ViewSet):
    """One endpoint to drive the split-pane allocation UI."""

    @action(detail=False, methods=['get'], url_path='workbench')
    def workbench(self, request):
        """Return unallocated payments + unpaid invoices side-by-side.

        Query params:
          contact_id: optional — filter both sides to one customer/supplier
          direction:  'AR' (default) | 'AP'   — receipts vs disbursements
        """
        from apps.finance.payment_models import Payment
        from apps.finance.invoice_models import Invoice, PaymentAllocation

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        direction = (request.query_params.get('direction') or 'AR').upper()
        contact_id = request.query_params.get('contact_id')

        # Payments with unallocated balance
        pay_qs = Payment.objects.filter(organization_id=org_id)
        if direction == 'AR':
            pay_qs = pay_qs.filter(type__in=('CUSTOMER_RECEIPT', 'RECEIPT'))
        else:
            pay_qs = pay_qs.filter(type__in=('SUPPLIER_PAYMENT', 'PAYMENT'))
        if contact_id:
            pay_qs = pay_qs.filter(contact_id=int(contact_id))

        # Compute unallocated in one query via subquery
        from django.db.models import F
        allocations_by_pay = {
            r['payment_id']: r['total']
            for r in PaymentAllocation.objects
            .filter(organization_id=org_id)
            .values('payment_id').annotate(total=Sum('allocated_amount'))
        }

        unalloc_payments = []
        for p in pay_qs.select_related('contact')[:200]:
            allocated = allocations_by_pay.get(p.id, Decimal('0.00')) or Decimal('0.00')
            unalloc = (p.amount or Decimal('0.00')) - allocated
            if unalloc <= Decimal('0.01'):
                continue
            unalloc_payments.append({
                'id': p.id,
                'contact_id': p.contact_id,
                'contact_name': getattr(p.contact, 'name', '') if p.contact_id else '',
                'payment_date': p.payment_date.isoformat() if p.payment_date else None,
                'amount': str(p.amount),
                'allocated': str(allocated),
                'unallocated': str(unalloc),
                'reference': getattr(p, 'reference', '') or getattr(p, 'transaction_ref', '') or '',
                'method': getattr(p, 'method', None) or getattr(p, 'payment_method', '') or '',
            })

        # Unpaid invoices (direction-matched)
        inv_qs = Invoice.objects.filter(
            organization_id=org_id,
            balance_due__gt=Decimal('0.01'),
        )
        if direction == 'AR':
            inv_qs = inv_qs.filter(type__in=('SALES', 'AR', 'CUSTOMER'))
        else:
            inv_qs = inv_qs.filter(type__in=('PURCHASE', 'AP', 'BILL', 'SUPPLIER'))
        if contact_id:
            inv_qs = inv_qs.filter(contact_id=int(contact_id))

        unpaid_invoices = [
            {
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'contact_id': inv.contact_id,
                'contact_name': getattr(inv.contact, 'name', '') if inv.contact_id else '',
                'issue_date': inv.issue_date.isoformat() if inv.issue_date else None,
                'due_date': inv.due_date.isoformat() if inv.due_date else None,
                'total_amount': str(inv.total_amount),
                'paid_amount': str(inv.paid_amount),
                'balance_due': str(inv.balance_due),
                'currency': inv.currency,
            }
            for inv in inv_qs.select_related('contact').order_by('due_date', 'id')[:200]
        ]

        # Auto-suggest: for each payment, find exact-amount invoice match
        # in the same contact. Label suggestions inline.
        suggestions = []
        for pay in unalloc_payments:
            match = None
            exact = [
                inv for inv in unpaid_invoices
                if inv['contact_id'] == pay['contact_id']
                and abs(Decimal(inv['balance_due']) - Decimal(pay['unallocated'])) < Decimal('0.01')
            ]
            if exact:
                match = exact[0]
            else:
                # Partial — sum of all same-contact invoices <= payment
                same = sorted(
                    (i for i in unpaid_invoices if i['contact_id'] == pay['contact_id']),
                    key=lambda i: i['due_date'] or '',
                )
                running = Decimal('0.00')
                picks = []
                for i in same:
                    if running + Decimal(i['balance_due']) <= Decimal(pay['unallocated']):
                        picks.append(i['id'])
                        running += Decimal(i['balance_due'])
                if picks:
                    match = {'picks': picks, 'covers': str(running)}
            if match:
                suggestions.append({
                    'payment_id': pay['id'],
                    'suggestion': match,
                })

        return Response({
            'direction': direction,
            'unallocated_payments': unalloc_payments,
            'unpaid_invoices': unpaid_invoices,
            'auto_suggestions': suggestions,
            'totals': {
                'unallocated_payments': str(sum(
                    (Decimal(p['unallocated']) for p in unalloc_payments),
                    Decimal('0.00'),
                )),
                'unpaid_invoices': str(sum(
                    (Decimal(i['balance_due']) for i in unpaid_invoices),
                    Decimal('0.00'),
                )),
            },
        })

    @action(detail=False, methods=['post'], url_path='allocate')
    def allocate(self, request):
        """Allocate a payment across one or more invoices.

        Body:
          payment_id: int (required)
          allocations: [{invoice_id: int, amount: str/decimal}, ...]

        Atomically creates PaymentAllocation rows and updates
        Invoice.paid_amount / balance_due via the existing
        invoice.record_payment() mechanism.
        """
        from apps.finance.payment_models import Payment
        from apps.finance.invoice_models import Invoice, PaymentAllocation

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        payment_id = request.data.get('payment_id')
        allocations = request.data.get('allocations') or []
        if not payment_id or not allocations:
            return Response(
                {'error': 'payment_id and non-empty allocations required'},
                status=400,
            )

        try:
            payment = Payment.objects.get(organization_id=org_id, id=payment_id)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=404)

        # Determine currently-unallocated amount
        allocated_so_far = payment.allocations.aggregate(
            s=Sum('allocated_amount'),
        )['s'] or Decimal('0.00')
        unalloc = (payment.amount or Decimal('0.00')) - allocated_so_far

        # Validate every allocation line
        total_to_allocate = Decimal('0.00')
        prepared = []
        for a in allocations:
            try:
                inv = Invoice.objects.get(organization_id=org_id, id=a['invoice_id'])
            except Invoice.DoesNotExist:
                return Response(
                    {'error': f"Invoice {a['invoice_id']} not found"}, status=400,
                )
            try:
                amt = Decimal(str(a['amount']))
            except Exception:
                return Response(
                    {'error': f"Invalid amount on invoice {inv.id}"}, status=400,
                )
            if amt <= Decimal('0.00'):
                continue
            if amt > inv.balance_due + Decimal('0.01'):
                return Response({
                    'error': (
                        f"Allocation {amt} exceeds invoice {inv.invoice_number} "
                        f"balance_due {inv.balance_due}"
                    ),
                }, status=400)
            total_to_allocate += amt
            prepared.append((inv, amt))

        if total_to_allocate > unalloc + Decimal('0.01'):
            return Response({
                'error': (
                    f"Total allocations {total_to_allocate} exceed payment "
                    f"unallocated balance {unalloc}"
                ),
            }, status=400)

        # Persist atomically
        created = []
        with transaction.atomic():
            for inv, amt in prepared:
                alloc = PaymentAllocation.objects.create(
                    organization=payment.organization,
                    payment=payment, invoice=inv, allocated_amount=amt,
                )
                # Update invoice paid_amount via its own method (preserves status transitions)
                try:
                    inv.record_payment(amt)
                except AttributeError:
                    # Fall back to direct update
                    inv.paid_amount = (inv.paid_amount or Decimal('0.00')) + amt
                    inv.balance_due = (inv.total_amount or Decimal('0.00')) - inv.paid_amount
                    if inv.balance_due <= Decimal('0.01'):
                        inv.status = 'PAID'
                    elif inv.paid_amount > Decimal('0.00'):
                        inv.status = 'PARTIAL_PAID'
                    inv.save(update_fields=['paid_amount', 'balance_due', 'status'])
                created.append({
                    'allocation_id': alloc.id,
                    'invoice_id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'amount': str(amt),
                    'remaining_balance': str(inv.balance_due),
                })

        return Response({
            'success': True,
            'payment_id': payment.id,
            'allocations_created': created,
            'total_allocated': str(total_to_allocate),
        }, status=status.HTTP_201_CREATED)
