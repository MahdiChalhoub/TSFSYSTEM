"""
Closing Snapshot Service — period and year-end immutable snapshots.

Captures hash-chained `FiscalPeriodCloseSnapshot` and
`FiscalYearCloseSnapshot` rows that record the trial-balance state
at the moment of close. Extracted from `closing_service.py` for the
300-line maintainability ceiling. Re-attached to `ClosingService` as
static methods by the facade.
"""
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def _capture_period_snapshot(organization, fiscal_period, user=None):
    """Write one FiscalPeriodCloseSnapshot row per scope.

    Mirrors `_capture_close_snapshot` but scoped to a single period.
    Idempotent via UNIQUE (fiscal_period, scope).
    Returns a list of brief dicts for the dry-run preview.
    """
    from apps.finance.models import (
        JournalEntryLine, FiscalPeriodCloseSnapshot, JournalEntry,
    )
    from django.db.models import Sum, Count

    out = []
    for scope in ('OFFICIAL', 'INTERNAL'):
        # Trial balance for the period (per-account net)
        rows = (
            JournalEntryLine.objects
            .filter(
                journal_entry__organization=organization,
                journal_entry__fiscal_period=fiscal_period,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__scope=scope,
            )
            .values('account_id', 'account__code', 'account__name', 'account__type')
            .annotate(d=Sum('debit'), c=Sum('credit'))
        )
        trial = []
        total_d = Decimal('0.00')
        total_c = Decimal('0.00')
        for r in rows:
            d = r['d'] or Decimal('0.00')
            c = r['c'] or Decimal('0.00')
            if d == 0 and c == 0:
                continue
            trial.append({
                'account_id': r['account_id'],
                'code': r['account__code'],
                'name': r['account__name'],
                'type': r['account__type'],
                'debit': str(d),
                'credit': str(c),
                'net': str(d - c),
            })
            total_d += d
            total_c += c
        trial.sort(key=lambda x: (x['code'] or '', x['account_id']))

        # Counts
        je_stats = (
            JournalEntry.objects
            .filter(
                organization=organization, fiscal_period=fiscal_period,
                status='POSTED', is_superseded=False, scope=scope,
            )
            .aggregate(n=Count('id'))
        )
        je_count = je_stats['n'] or 0
        je_lines = (
            JournalEntryLine.objects
            .filter(
                journal_entry__organization=organization,
                journal_entry__fiscal_period=fiscal_period,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__scope=scope,
            )
            .count()
        )
        unique_accts = len(trial)

        snap, _ = FiscalPeriodCloseSnapshot.objects.update_or_create(
            organization=organization,
            fiscal_period=fiscal_period,
            scope=scope,
            defaults={
                'movement_debit': total_d,
                'movement_credit': total_c,
                'je_count': je_count,
                'je_lines_count': je_lines,
                'unique_accounts_touched': unique_accts,
                'trial_balance': trial,
                'captured_by': user,
            },
        )
        out.append({
            'scope': scope,
            'je_count': je_count,
            'lines': je_lines,
            'total_debit': str(total_d),
            'total_credit': str(total_c),
            'accounts_touched': unique_accts,
            'content_hash': snap.content_hash,
        })
    return out


def _capture_close_snapshot(organization, fiscal_year, user=None):
    """Write one FiscalYearCloseSnapshot row per scope.

    Idempotent via the (fiscal_year, scope) UNIQUE constraint + an
    update_or_create pattern — re-running close_fiscal_year (e.g.
    after a reverse + re-finalize) overwrites the prior snapshot
    with fresh post-integrity-gate state.

    Called AFTER `_assert_close_integrity` so we can trust the
    numbers. Failure here rolls back everything (atomic block), so
    no half-finalized state can leak out.
    """
    from apps.finance.models import (
        JournalEntryLine, FiscalYearCloseSnapshot
    )
    from django.db.models import Sum, Q

    for scope in ('OFFICIAL', 'INTERNAL'):
        # Per-account trial balance for this scope, full BS + P&L.
        # P&L should be zero post-close, but we record it anyway —
        # a non-zero P&L line in the snapshot would be a smoking gun
        # of sweep failure that somehow slipped past the gate.
        rows = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
            journal_entry__scope=scope,
        ).filter(
            Q(journal_entry__fiscal_year=fiscal_year) |
            Q(journal_entry__fiscal_year__isnull=True,
              journal_entry__transaction_date__date__gte=fiscal_year.start_date,
              journal_entry__transaction_date__date__lte=fiscal_year.end_date)
        ).values(
            'account_id', 'account__code', 'account__name',
            'account__type', 'account__system_role',
        ).annotate(d=Sum('debit'), c=Sum('credit'))

        trial = []
        totals = {'ASSET': Decimal('0.00'), 'LIABILITY': Decimal('0.00'),
                  'EQUITY': Decimal('0.00'), 'INCOME': Decimal('0.00'),
                  'EXPENSE': Decimal('0.00')}
        re_value = Decimal('0.00')

        for r in rows:
            d = r['d'] or Decimal('0.00')
            c = r['c'] or Decimal('0.00')
            if d == 0 and c == 0:
                continue
            net = d - c
            atype = r['account__type']
            totals[atype] = totals.get(atype, Decimal('0.00')) + net
            if r['account__system_role'] == 'RETAINED_EARNINGS':
                re_value += net
            trial.append({
                'account_id': r['account_id'],
                'code': r['account__code'],
                'name': r['account__name'],
                'type': atype,
                'system_role': r['account__system_role'],
                'debit': str(d),
                'credit': str(c),
                'net': str(net),
            })

        trial.sort(key=lambda x: (x['code'] or '', x['account_id']))

        # P&L should be zero post-close; net_income here is the
        # *pre-close* figure we can reconstruct: -(INCOME + EXPENSE)
        # would all be zero at this point, so pull it from the closing
        # JE itself — it's the line targeting re_account whose amount
        # equals the year's net income.
        closing_je = (
            fiscal_year.closing_journal_entry if scope == 'OFFICIAL'
            else fiscal_year.internal_closing_journal_entry
        )
        net_income = Decimal('0.00')
        if closing_je:
            # Net income is what the closing JE posted to the RE
            # account; signed so positive = profit. RE line is the
            # balancing side, so we read it directly.
            re_lines = closing_je.lines.filter(
                account__system_role='RETAINED_EARNINGS'
            ).aggregate(d=Sum('debit'), c=Sum('credit'))
            # Closing entry: Dr RE means a loss (RE goes up as a DR,
            # reducing credit balance). Cr RE means profit.
            net_income = (re_lines['c'] or Decimal('0.00')) - (re_lines['d'] or Decimal('0.00'))

        opening_je = None
        if fiscal_year.closed_at:  # proxy for "there was a next year"
            from apps.finance.models import JournalEntry, FiscalYear
            nxt = FiscalYear.objects.filter(
                organization=organization,
                start_date__gt=fiscal_year.end_date,
            ).order_by('start_date').first()
            if nxt:
                opening_je = JournalEntry.objects.filter(
                    organization=organization,
                    fiscal_year=nxt,
                    journal_type='OPENING',
                    journal_role='SYSTEM_OPENING',
                    scope=scope,
                    status='POSTED',
                    is_superseded=False,
                ).first()

        # Sign totals per normal balance for human-readable reporting:
        # Assets positive when debit-positive, Liab/Equity positive
        # when credit-positive. trial_balance stores raw nets.
        total_assets = totals.get('ASSET', Decimal('0.00'))
        total_liab = -totals.get('LIABILITY', Decimal('0.00'))
        total_equity = -totals.get('EQUITY', Decimal('0.00'))

        FiscalYearCloseSnapshot.objects.update_or_create(
            organization=organization,
            fiscal_year=fiscal_year,
            scope=scope,
            defaults={
                'closing_journal_entry': closing_je,
                'opening_journal_entry': opening_je,
                'total_assets': total_assets,
                'total_liabilities': total_liab,
                'total_equity': total_equity,
                'net_income': net_income,
                'retained_earnings': -re_value,  # sign as credit-positive
                'trial_balance': trial,
                'captured_by': user,
            },
        )

    logger.info(
        f"ClosingService: Close snapshots captured for {fiscal_year.name} "
        f"(OFFICIAL + INTERNAL)"
    )
