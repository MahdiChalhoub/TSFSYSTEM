"""
FiscalYearViewSet mixin — `multi_year_comparison`.

N-year comparative P&L + Balance Sheet, strategic-review shape.
Inherited by `FiscalYearViewSet`.
"""
from decimal import Decimal

from .base import (
    Response, action,
    get_current_tenant_id,
)


class FiscalYearMultiYearMixin:
    """@action method: multi_year_comparison."""

    @action(detail=False, methods=['get'], url_path='multi-year-comparison')
    def multi_year_comparison(self, request):
        """N-year comparative P&L + Balance Sheet, strategic-review shape.

        Query params:
          years: how many years to include (2-10, default 3). Anchored
                 on the current FY (containing today) OR the most recent
                 CLOSED year, whichever is later.

        Response shape:
          {
            'years': [{'id','name','start','end'}, ...]  (newest first),
            'rollups': [
              {'section':'pnl', 'label':'Revenue', 'values':[str,str,...]},
              ...
            ],
            'per_account': [
              {'account_id','code','name','type','section','values':[str,...]},
              ...
            ],
          }
        """
        from apps.finance.models import FiscalYear, JournalEntryLine
        from django.db.models import Sum, Q
        from django.utils import timezone as _tz

        organization_id = get_current_tenant_id()

        # Resolve scope (header + query param), respecting authorized scope
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'
        ).lower()
        scope = (
            request.headers.get('X-Scope')
            or request.query_params.get('scope')
            or 'OFFICIAL'
        ).upper()
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'

        try:
            n = max(2, min(10, int(request.query_params.get('years') or 3)))
        except (TypeError, ValueError):
            n = 3

        # Pick anchor: current or latest year, then walk back n-1 more
        today = _tz.localdate()
        anchor = FiscalYear.objects.filter(
            organization_id=organization_id,
            start_date__lte=today, end_date__gte=today,
        ).order_by('-start_date').first()
        if anchor is None:
            anchor = FiscalYear.objects.filter(
                organization_id=organization_id,
            ).order_by('-end_date').first()
        if anchor is None:
            return Response({'years': [], 'rollups': [], 'per_account': []})

        years = [anchor]
        prev = anchor
        for _ in range(n - 1):
            nxt = (
                FiscalYear.objects
                .filter(organization_id=organization_id, end_date__lt=prev.start_date)
                .order_by('-end_date').first()
            )
            if not nxt:
                break
            years.append(nxt)
            prev = nxt
        # years list is [newest … oldest]; we'll emit columns in that order

        # P&L = period activity (per FY); BS = cumulative position as-of FY end.
        def _agg(fy):
            qs = JournalEntryLine.objects.filter(
                organization_id=organization_id,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
            ).filter(
                Q(journal_entry__fiscal_year=fy) |
                Q(journal_entry__fiscal_year__isnull=True,
                  journal_entry__transaction_date__date__gte=fy.start_date,
                  journal_entry__transaction_date__date__lte=fy.end_date)
            )
            if scope == 'OFFICIAL':
                qs = qs.filter(journal_entry__scope='OFFICIAL')
            rows = qs.values(
                'account_id', 'account__code', 'account__name', 'account__type'
            ).annotate(d=Sum('debit'), c=Sum('credit'))
            out = {}
            for r in rows:
                d = r['d'] or Decimal('0.00')
                c = r['c'] or Decimal('0.00')
                raw = d - c
                atype = r['account__type']
                net = (-raw) if atype in ('LIABILITY', 'EQUITY', 'INCOME') else raw
                out[r['account_id']] = {
                    'code': r['account__code'],
                    'name': r['account__name'],
                    'type': atype,
                    'net': net,
                }
            return out

        def _bs_agg_cumulative(fy):
            """BS as cumulative position through fy.end_date — without this,
            closed-FY BS rows show only in-year movements."""
            qs = JournalEntryLine.objects.filter(
                organization_id=organization_id,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                account__type__in=('ASSET', 'LIABILITY', 'EQUITY'),
                journal_entry__transaction_date__date__lte=fy.end_date,
            )
            if scope == 'OFFICIAL':
                qs = qs.filter(journal_entry__scope='OFFICIAL')
            rows = qs.values(
                'account_id', 'account__code', 'account__name', 'account__type'
            ).annotate(d=Sum('debit'), c=Sum('credit'))
            out = {}
            for r in rows:
                d = r['d'] or Decimal('0.00')
                c = r['c'] or Decimal('0.00')
                raw_net = d - c
                atype = r['account__type']
                net = (-raw_net) if atype in ('LIABILITY', 'EQUITY') else raw_net
                out[r['account_id']] = {
                    'code': r['account__code'], 'name': r['account__name'],
                    'type': atype, 'net': net,
                }
            return out

        per_year_pnl = [_agg(y) for y in years]
        per_year_bs = [_bs_agg_cumulative(y) for y in years]
        # Merge P&L (period) + BS (cumulative) — keys don't collide (account ids
        # are uniquely typed and each side filtered to its own type set).
        per_year = [{**p, **b} for p, b in zip(per_year_pnl, per_year_bs)]

        def _rollup_across(types):
            vals = []
            for yi in per_year:
                total = Decimal('0.00')
                for v in yi.values():
                    if v['type'] in types:
                        total += v['net']
                vals.append(str(total))
            return vals

        rev_vals = _rollup_across(('INCOME',))
        exp_vals = _rollup_across(('EXPENSE',))
        ni_vals = [
            str(Decimal(rev_vals[i]) - Decimal(exp_vals[i]))
            for i in range(len(years))
        ]

        rollups = [
            {'section': 'pnl',           'label': 'Revenue',     'values': rev_vals},
            {'section': 'pnl',           'label': 'Expenses',    'values': exp_vals},
            {'section': 'pnl',           'label': 'Net Income',  'values': ni_vals},
            {'section': 'balance_sheet', 'label': 'Assets',      'values': _rollup_across(('ASSET',))},
            {'section': 'balance_sheet', 'label': 'Liabilities', 'values': _rollup_across(('LIABILITY',))},
            {'section': 'balance_sheet', 'label': 'Equity',      'values': _rollup_across(('EQUITY',))},
        ]

        # Per-account matrix — union of ids across all years
        all_ids: set[int] = set()
        for yi in per_year:
            all_ids.update(yi.keys())
        TYPE_TO_SECTION = {
            'ASSET': 'balance_sheet', 'LIABILITY': 'balance_sheet', 'EQUITY': 'balance_sheet',
            'INCOME': 'pnl', 'EXPENSE': 'pnl',
        }
        per_account = []
        for acc_id in all_ids:
            ref = None
            vals = []
            for yi in per_year:
                v = yi.get(acc_id)
                if ref is None and v is not None:
                    ref = v
                vals.append(str(v['net']) if v else '0.00')
            if ref is None:
                continue
            # Skip accounts that are zero across all years
            if all(Decimal(x) == 0 for x in vals):
                continue
            per_account.append({
                'account_id': acc_id,
                'code': ref['code'],
                'name': ref['name'],
                'type': ref['type'],
                'section': TYPE_TO_SECTION.get(ref['type'], 'other'),
                'values': vals,
            })
        per_account.sort(key=lambda x: (x['section'], x['type'], x['code'] or ''))

        return Response({
            'years': [
                {
                    'id': y.id, 'name': y.name,
                    'start': y.start_date.isoformat(),
                    'end': y.end_date.isoformat(),
                }
                for y in years
            ],
            'rollups': rollups,
            'per_account': per_account,
        })
