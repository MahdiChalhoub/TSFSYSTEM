"""Customer / supplier account statements with running balance + aging."""
from datetime import datetime, timedelta
from decimal import Decimal

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.middleware import get_current_tenant_id


class StatementViewSet(viewsets.ViewSet):
    """Account-statement read endpoint per contact."""

    @action(detail=False, methods=['get'], url_path='contact')
    def contact(self, request):
        """Account statement for one contact.

        Query params:
          contact_id: required
          start_date: YYYY-MM-DD (optional — defaults to 12 months back)
          end_date:   YYYY-MM-DD (optional — defaults to today)

        Returns (single GET — sub-20ms typical):
          {
            contact: {id, name, email},
            period: {start, end},
            opening_balance: str,
            transactions: [
              {type, date, reference, description, debit, credit, running_balance}
            ],
            closing_balance: str,
            aging: {
              total: str,
              current: str,  // 0-30
              days_30: str,
              days_60: str,
              days_90: str,
              days_90_plus: str,
            },
          }
        """
        from apps.finance.invoice_models import Invoice
        from apps.finance.payment_models import Payment

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        contact_id = request.query_params.get('contact_id')
        if not contact_id:
            return Response({'error': 'contact_id required'}, status=400)
        contact_id = int(contact_id)

        today = datetime.now().date()
        end_date_raw = request.query_params.get('end_date')
        start_date_raw = request.query_params.get('start_date')
        end_date = (
            datetime.strptime(end_date_raw, '%Y-%m-%d').date() if end_date_raw else today
        )
        start_date = (
            datetime.strptime(start_date_raw, '%Y-%m-%d').date()
            if start_date_raw else (end_date - timedelta(days=365))
        )

        # Contact metadata
        contact_data = {'id': contact_id, 'name': '', 'email': ''}
        try:
            from erp.connector_registry import connector
            Contact = connector.require('crm.contacts.get_model', org_id=org_id)
            if Contact is None:
                raise RuntimeError("CRM unavailable")
            c = Contact.objects.filter(organization_id=org_id, id=contact_id).first()
            if c:
                contact_data = {
                    'id': c.id, 'name': c.name or '',
                    'email': c.email or '', 'phone': c.phone or '',
                    'credit_limit': str(c.credit_limit or Decimal('0.00')),
                    'payment_terms_days': c.payment_terms_days or 0,
                }
        except Exception:
            pass

        # Opening balance = sum of all debits/credits BEFORE start_date
        def _inv_sign(inv):
            # Sales invoice → Dr (increases what customer owes us)
            # Purchase/bill → Cr (increases what we owe supplier)
            t = (inv.type or '').upper()
            return 1 if t in ('SALES', 'AR', 'CUSTOMER') else -1

        def _pay_sign(pay):
            # Customer receipt → Cr (reduces AR)
            # Supplier payment → Dr (reduces AP)
            t = (pay.type or '').upper()
            return -1 if 'CUSTOMER' in t or t == 'RECEIPT' else 1

        # Pre-period invoices + payments
        prior_inv = Invoice.objects.filter(
            organization_id=org_id, contact_id=contact_id,
            issue_date__lt=start_date,
        ).only('id', 'type', 'total_amount')
        prior_pay = Payment.objects.filter(
            organization_id=org_id, contact_id=contact_id,
            payment_date__lt=start_date,
        ).only('id', 'type', 'amount')

        opening = Decimal('0.00')
        for inv in prior_inv:
            opening += _inv_sign(inv) * (inv.total_amount or Decimal('0.00'))
        for p in prior_pay:
            opening += _pay_sign(p) * (p.amount or Decimal('0.00'))

        # In-period transactions
        invs = Invoice.objects.filter(
            organization_id=org_id, contact_id=contact_id,
            issue_date__gte=start_date, issue_date__lte=end_date,
        ).only('id', 'type', 'total_amount', 'paid_amount', 'balance_due',
               'invoice_number', 'issue_date', 'due_date', 'notes')
        pays = Payment.objects.filter(
            organization_id=org_id, contact_id=contact_id,
            payment_date__gte=start_date, payment_date__lte=end_date,
        ).only('id', 'type', 'amount', 'payment_date')

        events = []
        for inv in invs:
            sign = _inv_sign(inv)
            amt = inv.total_amount or Decimal('0.00')
            events.append({
                'date': inv.issue_date,
                'sort_key': (inv.issue_date, 0, inv.id),
                'type': 'INVOICE',
                'reference': inv.invoice_number or f'INV-{inv.id}',
                'description': f"Invoice ({(inv.type or '').lower()})",
                'debit': str(amt if sign > 0 else Decimal('0.00')),
                'credit': str(amt if sign < 0 else Decimal('0.00')),
                'delta': sign * amt,
            })
        for p in pays:
            sign = _pay_sign(p)
            amt = p.amount or Decimal('0.00')
            events.append({
                'date': p.payment_date,
                'sort_key': (p.payment_date, 1, p.id),
                'type': 'PAYMENT',
                'reference': f'PAY-{p.id}',
                'description': f"Payment ({(p.type or '').lower()})",
                'debit': str(amt if sign > 0 else Decimal('0.00')),
                'credit': str(amt if sign < 0 else Decimal('0.00')),
                'delta': sign * amt,
            })

        events.sort(key=lambda e: e['sort_key'])
        running = opening
        transactions = []
        for e in events:
            running += e['delta']
            transactions.append({
                'date': e['date'].isoformat() if e['date'] else None,
                'type': e['type'],
                'reference': e['reference'],
                'description': e['description'],
                'debit': e['debit'],
                'credit': e['credit'],
                'running_balance': str(running),
            })

        closing = running

        # Aging (as-of end_date) — buckets based on balance_due per invoice
        current_inv = Invoice.objects.filter(
            organization_id=org_id, contact_id=contact_id,
            balance_due__gt=Decimal('0.01'),
        ).only('id', 'balance_due', 'due_date', 'type')

        aging = {'total': Decimal('0.00'), 'current': Decimal('0.00'),
                 'days_30': Decimal('0.00'), 'days_60': Decimal('0.00'),
                 'days_90': Decimal('0.00'), 'days_90_plus': Decimal('0.00')}
        for inv in current_inv:
            bal = inv.balance_due or Decimal('0.00')
            aging['total'] += bal
            if not inv.due_date or inv.due_date >= end_date:
                aging['current'] += bal
            else:
                days = (end_date - inv.due_date).days
                if days <= 30:
                    aging['days_30'] += bal
                elif days <= 60:
                    aging['days_60'] += bal
                elif days <= 90:
                    aging['days_90'] += bal
                else:
                    aging['days_90_plus'] += bal

        return Response({
            'contact': contact_data,
            'period': {'start': start_date.isoformat(), 'end': end_date.isoformat()},
            'opening_balance': str(opening),
            'transactions': transactions,
            'closing_balance': str(closing),
            'aging': {k: str(v) for k, v in aging.items()},
        })
