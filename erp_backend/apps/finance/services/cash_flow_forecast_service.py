"""
Cash-flow forecast service.

Answers the single most-asked SMB question: "will I have enough cash on
`day X`?" by projecting bank/cash balance forward from today through
an operator-chosen horizon.

Sources of truth (in order of confidence):
  1. **Starting position** — sum of current balances on accounts whose
     `sub_type in (BANK, CASH)` or `system_role in (CASH_ACCOUNT,
     BANK_ACCOUNT)`. Uses authoritative JE-line aggregation (not the
     denormalized `balance` field, which can drift).
  2. **Known inflows** — unpaid SALES/AR invoices booked to due_date.
  3. **Known outflows** — unpaid PURCHASE/AP invoices booked to due_date.
  4. **Recurring items** — every `RecurringJournalTemplate` that is
     ACTIVE and hits a cash account on at least one line. Each future
     `next_run_date` within the horizon is projected.

Intentionally NOT projected:
  - Payroll (not modelled in this codebase yet)
  - Tax filings (CountryTaxTemplate exists but no due-date scheduler)
  - Draft JEs (un-posted, not committed)

These produce a `gaps` list the operator can review — surfacing what's
not projected so nobody assumes the model knows about payroll when it
doesn't.
"""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone


class CashFlowForecastService:
    """Project bank/cash balance forward from today."""

    @staticmethod
    def forecast(organization, *, horizon_days=90, granularity='DAILY',
                 as_of=None, include_recurring=True, scope='OFFICIAL'):
        """Run a cash-flow forecast.

        Args:
            organization: target org.
            horizon_days: how far forward to project (1-365).
            granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY' (bucket size).
            as_of: override "today" for tests.
            include_recurring: if False, skip recurring journals (rarely
                needed — useful for base-case vs. with-recurring comparison).

        Returns:
            {
              as_of: ISO date,
              horizon_days, granularity,
              starting_position: str,
              cash_accounts: [{id, code, name, current}, ...],
              buckets: [
                {date, inflow, outflow, net, projected_balance, is_danger},
                ...
              ],
              upcoming_inflows: [...],
              upcoming_outflows: [...],
              summary: {
                total_expected_inflow, total_expected_outflow,
                net_change, lowest_balance, lowest_balance_date,
                days_until_negative or None,
              },
              gaps: [list of unprojected categories for operator awareness],
            }
        """
        horizon_days = max(1, min(365, int(horizon_days)))
        granularity = granularity.upper()
        if granularity not in ('DAILY', 'WEEKLY', 'MONTHLY'):
            granularity = 'DAILY'
        today = as_of or timezone.now().date()
        end_date = today + timedelta(days=horizon_days)

        # ── Starting position ──
        starting, cash_accounts = CashFlowForecastService._starting_position(
            organization, as_of=today, scope=scope,
        )

        # ── Collect all future cash-impacting events ──
        events = []  # list of {date, amount (signed), kind, label, ref}

        events.extend(CashFlowForecastService._ar_events(organization, today, end_date))
        events.extend(CashFlowForecastService._ap_events(organization, today, end_date))

        if include_recurring:
            events.extend(
                CashFlowForecastService._recurring_events(
                    organization, today, end_date, cash_accounts,
                )
            )

        # ── Bucket by granularity ──
        bucket_map = defaultdict(lambda: {'inflow': Decimal('0.00'),
                                          'outflow': Decimal('0.00'),
                                          'events': []})
        for ev in events:
            b = CashFlowForecastService._bucket_key(ev['date'], granularity)
            row = bucket_map[b]
            if ev['amount'] > 0:
                row['inflow'] += ev['amount']
            else:
                row['outflow'] += -ev['amount']
            row['events'].append(ev)

        # Emit buckets in chronological order, fill empties
        buckets = []
        running = starting
        lowest_balance = starting
        lowest_date = today
        days_until_negative = None

        cur = today
        while cur <= end_date:
            key = CashFlowForecastService._bucket_key(cur, granularity)
            row = bucket_map.get(key, {'inflow': Decimal('0.00'),
                                       'outflow': Decimal('0.00'),
                                       'events': []})
            net = row['inflow'] - row['outflow']
            running += net
            if running < lowest_balance:
                lowest_balance = running
                lowest_date = cur
            if days_until_negative is None and running < Decimal('0.00'):
                days_until_negative = (cur - today).days

            buckets.append({
                'date': cur.isoformat(),
                'inflow': str(row['inflow']),
                'outflow': str(row['outflow']),
                'net': str(net),
                'projected_balance': str(running),
                'is_danger': running < Decimal('0.00'),
                'event_count': len(row['events']),
            })
            cur = CashFlowForecastService._bucket_step(cur, granularity)

        # Separate upcoming-lists (top of list by amount within first 14 days)
        early_cutoff = today + timedelta(days=14)
        upcoming_inflows = sorted(
            [e for e in events if e['amount'] > 0 and e['date'] <= early_cutoff],
            key=lambda e: (-float(e['amount']), e['date']),
        )[:20]
        upcoming_outflows = sorted(
            [e for e in events if e['amount'] < 0 and e['date'] <= early_cutoff],
            key=lambda e: (float(e['amount']), e['date']),
        )[:20]

        total_in = sum((e['amount'] for e in events if e['amount'] > 0), Decimal('0.00'))
        total_out = sum((-e['amount'] for e in events if e['amount'] < 0), Decimal('0.00'))

        return {
            'as_of': today.isoformat(),
            'horizon_days': horizon_days,
            'granularity': granularity,
            'starting_position': str(starting),
            'cash_accounts': cash_accounts,
            'buckets': buckets,
            'upcoming_inflows': [
                {**e, 'date': e['date'].isoformat(), 'amount': str(e['amount'])}
                for e in upcoming_inflows
            ],
            'upcoming_outflows': [
                {**e, 'date': e['date'].isoformat(), 'amount': str(e['amount'])}
                for e in upcoming_outflows
            ],
            'summary': {
                'total_expected_inflow': str(total_in),
                'total_expected_outflow': str(total_out),
                'net_change': str(total_in - total_out),
                'ending_balance': str(running),
                'lowest_balance': str(lowest_balance),
                'lowest_balance_date': lowest_date.isoformat(),
                'days_until_negative': days_until_negative,
            },
            'gaps': [
                'Payroll is not projected (no payroll module installed).',
                'Tax-filing deadlines are not projected.',
                'DRAFT journal entries are ignored — post or delete them to reflect.',
                'Overdue AR is projected at the due_date, not a probability-weighted collection date.',
            ],
        }

    # ── Internals ─────────────────────────────────────────────

    @staticmethod
    def _bucket_key(d, granularity):
        if granularity == 'DAILY':
            return d
        if granularity == 'WEEKLY':
            return d - timedelta(days=d.weekday())  # Monday of the week
        # MONTHLY
        return date(d.year, d.month, 1)

    @staticmethod
    def _bucket_step(d, granularity):
        if granularity == 'DAILY':
            return d + timedelta(days=1)
        if granularity == 'WEEKLY':
            return d + timedelta(days=7)
        # MONTHLY — advance to 1st of next month
        if d.month == 12:
            return date(d.year + 1, 1, 1)
        return date(d.year, d.month + 1, 1)

    @staticmethod
    def _starting_position(organization, *, as_of, scope='OFFICIAL'):
        """Sum authoritative JE-line balance on cash/bank accounts as-of `as_of`.

        OFFICIAL → counts only OFFICIAL-tagged journals (cash position you'd
        report externally). INTERNAL → counts all journals (true cash on hand).
        """
        from apps.finance.models import ChartOfAccount, JournalEntryLine

        cash_qs = ChartOfAccount.objects.filter(
            organization=organization, is_active=True,
        ).filter(
            # Either sub_type CASH/BANK or system_role CASH/BANK
            sub_type__in=['CASH', 'BANK']
        ) | ChartOfAccount.objects.filter(
            organization=organization, is_active=True,
            system_role__in=['CASH_ACCOUNT', 'BANK_ACCOUNT'],
        )
        # OFFICIAL view hides internal-only accounts (they wouldn't be reportable).
        if scope == 'OFFICIAL':
            cash_qs = cash_qs.filter(is_internal=False)
        cash_qs = cash_qs.distinct()

        cash_accounts = []
        total = Decimal('0.00')
        for acc in cash_qs:
            line_qs = JournalEntryLine.objects.filter(
                organization=organization, account=acc,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__transaction_date__date__lte=as_of,
            )
            if scope == 'OFFICIAL':
                line_qs = line_qs.filter(journal_entry__scope='OFFICIAL')
            agg = line_qs.aggregate(d=Sum('debit'), c=Sum('credit'))
            d = agg['d'] or Decimal('0.00')
            c = agg['c'] or Decimal('0.00')
            net = d - c  # cash accounts are debit-positive
            total += net
            cash_accounts.append({
                'id': acc.id, 'code': acc.code, 'name': acc.name,
                'current': str(net),
            })
        return total, cash_accounts

    @staticmethod
    def _ar_events(organization, start, end):
        """Unpaid customer invoices due within [start, end]."""
        from apps.finance.invoice_models import Invoice
        out = []
        qs = Invoice.objects.filter(
            organization=organization,
            type__in=('SALES', 'AR', 'CUSTOMER'),
            balance_due__gt=Decimal('0.01'),
            due_date__gte=start, due_date__lte=end,
        ).select_related('contact')
        for inv in qs:
            out.append({
                'date': inv.due_date,
                'amount': inv.balance_due,  # positive = inflow
                'kind': 'AR_INVOICE',
                'label': f"{inv.invoice_number or f'INV-{inv.id}'} · {getattr(inv.contact, 'name', '—')}",
                'ref': {'model': 'invoice', 'id': inv.id},
            })
        # Also include OVERDUE invoices — project them at today (i.e. assume
        # payment today but flag as "overdue" so UI can badge them)
        overdue_qs = Invoice.objects.filter(
            organization=organization,
            type__in=('SALES', 'AR', 'CUSTOMER'),
            balance_due__gt=Decimal('0.01'),
            due_date__lt=start,
        ).select_related('contact')
        for inv in overdue_qs:
            days = (start - inv.due_date).days
            out.append({
                'date': start,
                'amount': inv.balance_due,
                'kind': 'AR_INVOICE_OVERDUE',
                'label': (
                    f"{inv.invoice_number or f'INV-{inv.id}'} · "
                    f"{getattr(inv.contact, 'name', '—')} · OVERDUE {days}d"
                ),
                'ref': {'model': 'invoice', 'id': inv.id},
            })
        return out

    @staticmethod
    def _ap_events(organization, start, end):
        """Unpaid supplier invoices due within [start, end]."""
        from apps.finance.invoice_models import Invoice
        out = []
        qs = Invoice.objects.filter(
            organization=organization,
            type__in=('PURCHASE', 'AP', 'BILL', 'SUPPLIER'),
            balance_due__gt=Decimal('0.01'),
            due_date__gte=start, due_date__lte=end,
        ).select_related('contact')
        for inv in qs:
            out.append({
                'date': inv.due_date,
                'amount': -inv.balance_due,  # negative = outflow
                'kind': 'AP_INVOICE',
                'label': f"{inv.invoice_number or f'BILL-{inv.id}'} · {getattr(inv.contact, 'name', '—')}",
                'ref': {'model': 'invoice', 'id': inv.id},
            })
        # Include overdue AP the same way — they'll hit today
        overdue_qs = Invoice.objects.filter(
            organization=organization,
            type__in=('PURCHASE', 'AP', 'BILL', 'SUPPLIER'),
            balance_due__gt=Decimal('0.01'),
            due_date__lt=start,
        ).select_related('contact')
        for inv in overdue_qs:
            days = (start - inv.due_date).days
            out.append({
                'date': start,
                'amount': -inv.balance_due,
                'kind': 'AP_INVOICE_OVERDUE',
                'label': (
                    f"{inv.invoice_number or f'BILL-{inv.id}'} · "
                    f"{getattr(inv.contact, 'name', '—')} · OVERDUE {days}d"
                ),
                'ref': {'model': 'invoice', 'id': inv.id},
            })
        return out

    @staticmethod
    def _recurring_events(organization, start, end, cash_accounts):
        """Project recurring journal templates. Walk next_run_date forward
        by frequency until past `end`. Sums lines by cash-account impact
        (positive = cash in, negative = out) per occurrence.
        """
        from apps.finance.models import RecurringJournalTemplate, RecurringJournalLine

        cash_ids = {a['id'] for a in cash_accounts}
        out = []
        templates = RecurringJournalTemplate.objects.filter(
            organization=organization,
            status='ACTIVE',
            next_run_date__lte=end,
        ).prefetch_related('lines')

        for tpl in templates:
            # Compute cash impact per occurrence from this template's lines
            net_per_occurrence = Decimal('0.00')
            for line in tpl.lines.all():
                if line.account_id in cash_ids:
                    net_per_occurrence += (line.debit or Decimal('0.00')) - (line.credit or Decimal('0.00'))
            if net_per_occurrence == Decimal('0.00'):
                continue

            # Walk occurrences within [start, end]
            cursor = max(tpl.next_run_date or start, start)
            safety = 0
            while cursor <= end and safety < 400:
                if (tpl.end_date is None) or (cursor <= tpl.end_date):
                    out.append({
                        'date': cursor,
                        'amount': net_per_occurrence,
                        'kind': 'RECURRING_OUT' if net_per_occurrence < 0 else 'RECURRING_IN',
                        'label': f"Recurring: {tpl.name} ({tpl.frequency})",
                        'ref': {'model': 'recurring_journal', 'id': tpl.id},
                    })
                cursor = CashFlowForecastService._step_recurring(cursor, tpl.frequency)
                safety += 1

        return out

    @staticmethod
    def _step_recurring(d, frequency):
        if frequency == 'DAILY':
            return d + timedelta(days=1)
        if frequency == 'WEEKLY':
            return d + timedelta(days=7)
        if frequency == 'MONTHLY':
            if d.month == 12:
                return date(d.year + 1, 1, min(d.day, 28))
            return date(d.year, d.month + 1, min(d.day, 28))
        if frequency == 'QUARTERLY':
            m = d.month + 3
            y = d.year + (m - 1) // 12
            m = ((m - 1) % 12) + 1
            return date(y, m, min(d.day, 28))
        if frequency == 'SEMI_ANNUAL':
            m = d.month + 6
            y = d.year + (m - 1) // 12
            m = ((m - 1) % 12) + 1
            return date(y, m, min(d.day, 28))
        if frequency == 'ANNUAL':
            return date(d.year + 1, d.month, min(d.day, 28))
        return d + timedelta(days=30)  # fallback
