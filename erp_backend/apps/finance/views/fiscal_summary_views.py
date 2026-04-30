"""
FiscalYearViewSet mixin — `summary` (year-end summary report).

P&L + Balance Sheet + closing entries + opening balances + period stats
for a single fiscal year. Inherited by `FiscalYearViewSet`. Helpers
extracted to module-level to keep the orchestrator under the 300-line
maintainability ceiling.
"""
from decimal import Decimal

from .base import (
    status, Response, action,
    get_current_tenant_id, Organization,
)


def _resolve_scope(request):
    """Return scope ('OFFICIAL' or 'INTERNAL') after honoring the
    auth-cookie / X-Scope-Access cage."""
    from erp.middleware import get_authorized_scope
    authorized = (
        request.headers.get('X-Scope-Access')
        or get_authorized_scope()
        or 'official'
    ).lower()
    requested = (
        request.query_params.get('scope')
        or request.headers.get('X-Scope')
        or 'OFFICIAL'
    ).upper()
    if authorized == 'official' and requested == 'INTERNAL':
        requested = 'OFFICIAL'
    return requested


def _serialize_closing_je(je_obj, scope_label):
    if not je_obj:
        return None
    from apps.finance.models import JournalEntryLine
    lines = JournalEntryLine.objects.filter(journal_entry=je_obj).select_related('account').order_by('-debit', 'credit')
    return {
        'id': je_obj.id,
        'reference': je_obj.reference,
        'date': str(je_obj.transaction_date),
        'description': je_obj.description,
        'scope': scope_label,
        'lines': [{'code': l.account.code, 'name': l.account.name, 'debit': float(l.debit), 'credit': float(l.credit)} for l in lines],
    }


def _ob_rows_for_year(target_year, org, scope):
    """Shape-stable list of {code,name,type,debit,credit} for UI.
    Reads from the OPENING JE when USE_JE_OPENING is set, else falls
    back to the legacy OpeningBalance table."""
    from apps.finance.models import JournalEntryLine, OpeningBalance
    from django.conf import settings as _s
    if getattr(_s, 'USE_JE_OPENING', False):
        # Scope to SYSTEM_OPENING so user-entered capital injections
        # don't render as "carry-forward" — those live in the regular
        # JE list, not the year-summary.
        lines = (
            JournalEntryLine.objects
            .filter(
                journal_entry__organization=org,
                journal_entry__fiscal_year=target_year,
                journal_entry__journal_type='OPENING',
                journal_entry__journal_role='SYSTEM_OPENING',
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
            )
            .select_related('account')
            .order_by('account__type', 'account__code')
        )
        if scope == 'OFFICIAL':
            lines = lines.filter(journal_entry__scope='OFFICIAL')
        return [{
            'code': l.account.code, 'name': l.account.name, 'type': l.account.type,
            'debit': float(l.debit or 0), 'credit': float(l.credit or 0),
        } for l in lines]
    obs = (
        OpeningBalance.objects
        .filter(organization=org, fiscal_year=target_year)
        .select_related('account')
        .order_by('account__type', 'account__code')
    )
    return [{
        'code': ob.account.code, 'name': ob.account.name, 'type': ob.account.type,
        'debit': float(ob.debit_amount), 'credit': float(ob.credit_amount),
    } for ob in obs]


def _opening_entries_for_year(target_year, org, scope):
    if not target_year:
        return []
    from apps.finance.models import JournalEntry
    rows = []
    qs = JournalEntry.objects.filter(
        organization=org, fiscal_year=target_year,
        journal_type='OPENING',
        journal_role='SYSTEM_OPENING',
        status='POSTED',
        is_superseded=False,
    ).order_by('scope', 'transaction_date')
    if scope == 'OFFICIAL':
        qs = qs.filter(scope='OFFICIAL')
    for je in qs:
        rows.append({
            'id': je.id,
            'reference': je.reference,
            'scope': je.scope,
            'transaction_date': str(je.transaction_date.date()) if je.transaction_date else None,
            'line_count': je.lines.count(),
            'total_debit': float(je.total_debit or 0),
            'total_credit': float(je.total_credit or 0),
        })
    return rows


class FiscalYearSummaryMixin:
    """@action method: summary."""

    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, pk=None):
        """Year-end summary: P&L, BS, closing entry, opening balances, period stats."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        org = Organization.objects.get(id=organization_id)

        from apps.finance.models import JournalEntry, JournalEntryLine, FiscalYear as FY
        from django.db.models import Sum, Count, Q

        scope = _resolve_scope(request)

        def _scope_filter(qs, prefix=''):
            if scope == 'OFFICIAL':
                key = f'{prefix}scope' if prefix else 'scope'
                return qs.filter(**{key: 'OFFICIAL'})
            return qs

        periods = fiscal_year.periods.all().order_by('start_date')

        # Match by FK OR by date range — catches orphan JEs (fiscal_year=NULL)
        je_qs = JournalEntry.objects.filter(organization=org).filter(
            Q(fiscal_year=fiscal_year) |
            Q(fiscal_year__isnull=True,
              transaction_date__date__gte=fiscal_year.start_date,
              transaction_date__date__lte=fiscal_year.end_date)
        )
        je_qs = _scope_filter(je_qs)
        je_stats = je_qs.aggregate(
            total=Count('id'),
            posted=Count('id', filter=Q(status='POSTED')),
            draft=Count('id', filter=Q(status='DRAFT')),
            total_debit=Sum('total_debit'),
            total_credit=Sum('total_credit'),
        )

        # IDs to exclude from P&L aggregation: closing JEs (per scope)
        _exclude_je_ids = set()
        if fiscal_year.closing_journal_entry_id:
            _exclude_je_ids.add(fiscal_year.closing_journal_entry_id)
        if hasattr(fiscal_year, 'internal_closing_journal_entry_id') and fiscal_year.internal_closing_journal_entry_id:
            _exclude_je_ids.add(fiscal_year.internal_closing_journal_entry_id)

        def _net_by_types(types):
            """Sum net (debit-credit) for given account types within this FY,
            excluding closing/SYSTEM_OPENING JEs so we see business activity."""
            qs = JournalEntryLine.objects.filter(
                organization=org,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
            ).filter(
                Q(journal_entry__fiscal_year=fiscal_year) |
                Q(journal_entry__fiscal_year__isnull=True,
                  journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                  journal_entry__transaction_date__date__lte=fiscal_year.end_date)
            ).filter(account__type__in=types).exclude(
                journal_entry__journal_type='CLOSING'
            ).exclude(journal_entry__journal_role='SYSTEM_OPENING')
            if _exclude_je_ids:
                qs = qs.exclude(journal_entry_id__in=_exclude_je_ids)
            qs = _scope_filter(qs, 'journal_entry__')
            agg = qs.aggregate(d=Sum('debit'), c=Sum('credit'))
            return (agg['d'] or Decimal(0)) - (agg['c'] or Decimal(0))

        # P&L: Income is credit-normal → negate; Expense is debit-normal
        revenue = abs(_net_by_types(['INCOME']))
        expense_bal = _net_by_types(['EXPENSE'])
        net_income = revenue - expense_bal

        def _bs_position(types):
            """BS is a *position*: cumulative through fiscal_year.end_date,
            opening + closing JEs INCLUDED so we get true closing balances."""
            qs = JournalEntryLine.objects.filter(
                organization=org,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                account__type__in=types,
                journal_entry__transaction_date__date__lte=fiscal_year.end_date,
            )
            qs = _scope_filter(qs, 'journal_entry__')
            agg = qs.aggregate(d=Sum('debit'), c=Sum('credit'))
            return (agg['d'] or Decimal(0)) - (agg['c'] or Decimal(0))

        asset_bal = _bs_position(['ASSET'])
        raw_liability = _bs_position(['LIABILITY'])
        raw_equity = _bs_position(['EQUITY'])

        def _net_by_types_raw(types):
            """Same as _net_by_types but without excluding closing/opening JEs."""
            qs = JournalEntryLine.objects.filter(
                organization=org,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
            ).filter(
                Q(journal_entry__fiscal_year=fiscal_year) |
                Q(journal_entry__fiscal_year__isnull=True,
                  journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                  journal_entry__transaction_date__date__lte=fiscal_year.end_date)
            ).filter(account__type__in=types)
            qs = _scope_filter(qs, 'journal_entry__')
            agg = qs.aggregate(d=Sum('debit'), c=Sum('credit'))
            return (agg['d'] or Decimal(0)) - (agg['c'] or Decimal(0))

        revenue_pc = abs(_net_by_types_raw(['INCOME']))
        expense_pc = _net_by_types_raw(['EXPENSE'])
        net_income_pc = revenue_pc - expense_pc

        # Closing entries — one per scope (OFFICIAL + INTERNAL)
        # OFFICIAL view shows only OFFICIAL closing JE; INTERNAL shows both.
        closing_entries = []
        if fiscal_year.closing_journal_entry_id:
            ce = _serialize_closing_je(fiscal_year.closing_journal_entry, 'OFFICIAL')
            if ce:
                closing_entries.append(ce)
        if (
            scope == 'INTERNAL'
            and hasattr(fiscal_year, 'internal_closing_journal_entry_id')
            and fiscal_year.internal_closing_journal_entry_id
        ):
            ce = _serialize_closing_je(fiscal_year.internal_closing_journal_entry, 'INTERNAL')
            if ce:
                closing_entries.append(ce)
        closing_je = closing_entries[0] if closing_entries else None

        # Opening balances generated for next year (what THIS year sends out)
        next_fy = FY.objects.filter(
            organization=org, start_date__gt=fiscal_year.end_date
        ).order_by('start_date').first()
        opening_bals = _ob_rows_for_year(next_fy, org, scope) if next_fy else []
        opening_bals_received = _ob_rows_for_year(fiscal_year, org, scope)

        opening_entries = _opening_entries_for_year(next_fy, org, scope)
        opening_entries_received = _opening_entries_for_year(fiscal_year, org, scope)

        # Period breakdown
        period_data = []
        for p in periods:
            p_je_qs = JournalEntry.objects.filter(fiscal_period=p, status='POSTED')
            p_je_count = _scope_filter(p_je_qs).count()
            period_data.append({
                'name': p.name, 'status': p.status,
                'start_date': str(p.start_date), 'end_date': str(p.end_date),
                'journal_entries': p_je_count,
            })

        return Response({
            'year': {'name': fiscal_year.name, 'start_date': str(fiscal_year.start_date), 'end_date': str(fiscal_year.end_date),
                     'status': fiscal_year.status, 'is_hard_locked': fiscal_year.is_hard_locked,
                     'closed_at': fiscal_year.closed_at.isoformat() if fiscal_year.closed_at else None},
            'journal_entries': {
                'total': je_stats['total'] or 0, 'posted': je_stats['posted'] or 0, 'draft': je_stats['draft'] or 0,
                'total_debit': float(je_stats['total_debit'] or 0), 'total_credit': float(je_stats['total_credit'] or 0),
            },
            'pnl': {'revenue': float(revenue), 'expenses': float(expense_bal), 'net_income': float(net_income)},
            'pnl_post_close': {'revenue': float(revenue_pc), 'expenses': float(expense_pc), 'net_income': float(net_income_pc)},
            'balance_sheet': {
                'assets': float(asset_bal), 'liabilities': float(abs(raw_liability)),
                'equity': float(abs(raw_equity)),
            },
            'closing_entry': closing_je,
            'closing_entries': closing_entries,
            'opening_balances': opening_bals,
            'opening_balances_target': next_fy.name if next_fy else None,
            'opening_balances_received': opening_bals_received,
            'opening_entries': opening_entries,
            'opening_entries_received': opening_entries_received,
            'periods': period_data,
        })
