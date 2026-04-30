"""
FiscalYearViewSet mixin — `yoy_comparison`.

Year-over-year comparative P&L + Balance Sheet + KPIs against the
immediately prior fiscal year. Inherited by `FiscalYearViewSet`.
"""
from decimal import Decimal

from .base import (
    Response, action,
    get_current_tenant_id,
)


class FiscalYearYoYMixin:
    """@action method: yoy_comparison."""

    @action(detail=True, methods=['get'], url_path='yoy-comparison')
    def yoy_comparison(self, request, pk=None):
        """Year-over-year comparative P&L + Balance Sheet + KPIs.

        Compares THIS fiscal year's totals to the immediately prior
        fiscal year (by end_date). Reads directly from POSTED, non-
        superseded JE lines.

        Scope contract (matches `summary` and the COA endpoint):
          OFFICIAL → only OFFICIAL-tagged journals
          INTERNAL → all journals (OFFICIAL + INTERNAL combined)
        """
        from apps.finance.models import FiscalYear, JournalEntryLine
        from django.db.models import Sum, Q

        current = self.get_object()
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

        # Find the immediately-prior fiscal year by end_date
        prior = (
            FiscalYear.objects
            .filter(organization_id=organization_id, end_date__lt=current.start_date)
            .order_by('-end_date').first()
        )

        def _agg(fy):
            """Per-account aggregation for a fiscal year, scope-filtered.
            Net is signed with normal-balance convention flipped for
            display (debit-positive ASSET/EXPENSE, credit-positive
            LIABILITY/EQUITY/INCOME)."""
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
                raw_net = d - c
                atype = r['account__type']
                net = (-raw_net) if atype in ('LIABILITY', 'EQUITY', 'INCOME') else raw_net
                out[r['account_id']] = {
                    'code': r['account__code'],
                    'name': r['account__name'],
                    'type': atype,
                    'net': net,
                }
            return out

        # P&L is period-only via _agg; BS is a position — needs cumulative.
        def _bs_agg_cumulative(fy):
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

        # P&L per-account uses period activity; BS per-account uses cumulative
        # position. Merge so per-account display works for both sections.
        curr_by_acc_pnl = _agg(current)
        prior_by_acc_pnl = _agg(prior) if prior else {}
        curr_by_acc_bs = _bs_agg_cumulative(current)
        prior_by_acc_bs = _bs_agg_cumulative(prior) if prior else {}

        curr_by_acc = {**curr_by_acc_pnl, **curr_by_acc_bs}
        prior_by_acc = {**prior_by_acc_pnl, **prior_by_acc_bs}

        def _delta(a, b):
            delta = a - b
            pct = None
            if b != Decimal('0.00'):
                pct = float(delta / b.copy_abs() * 100)
            return {
                'current': str(a), 'prior': str(b),
                'delta': str(delta), 'pct': pct,
            }

        def _rollup(rows_by_acc, types):
            total = Decimal('0.00')
            for v in rows_by_acc.values():
                if v['type'] in types:
                    total += v['net']
            return total

        curr_rev = _rollup(curr_by_acc, ('INCOME',))
        prior_rev = _rollup(prior_by_acc, ('INCOME',))
        curr_exp = _rollup(curr_by_acc, ('EXPENSE',))
        prior_exp = _rollup(prior_by_acc, ('EXPENSE',))
        curr_net = curr_rev - curr_exp
        prior_net = prior_rev - prior_exp

        curr_assets = _rollup(curr_by_acc, ('ASSET',))
        prior_assets = _rollup(prior_by_acc, ('ASSET',))
        curr_liab = _rollup(curr_by_acc, ('LIABILITY',))
        prior_liab = _rollup(prior_by_acc, ('LIABILITY',))
        curr_eq = _rollup(curr_by_acc, ('EQUITY',))
        prior_eq = _rollup(prior_by_acc, ('EQUITY',))

        # Per-account detail — union of current + prior keys
        all_ids = set(curr_by_acc) | set(prior_by_acc)
        per_account = []
        for acc_id in all_ids:
            c_v = curr_by_acc.get(acc_id)
            p_v = prior_by_acc.get(acc_id)
            ref = c_v or p_v
            c_net = c_v['net'] if c_v else Decimal('0.00')
            p_net = p_v['net'] if p_v else Decimal('0.00')
            if c_net == 0 and p_net == 0:
                continue
            per_account.append({
                'account_id': acc_id,
                'code': ref['code'],
                'name': ref['name'],
                'type': ref['type'],
                **_delta(c_net, p_net),
            })
        per_account.sort(key=lambda x: (x['type'], x['code'] or ''))

        return Response({
            'current_year': {
                'id': current.id, 'name': current.name,
                'start': current.start_date.isoformat(),
                'end': current.end_date.isoformat(),
            },
            'prior_year': (
                {
                    'id': prior.id, 'name': prior.name,
                    'start': prior.start_date.isoformat(),
                    'end': prior.end_date.isoformat(),
                } if prior else None
            ),
            'pnl': {
                'revenue': _delta(curr_rev, prior_rev),
                'expenses': _delta(curr_exp, prior_exp),
                'net_income': _delta(curr_net, prior_net),
            },
            'balance_sheet': {
                'assets': _delta(curr_assets, prior_assets),
                'liabilities': _delta(curr_liab, prior_liab),
                'equity': _delta(curr_eq, prior_eq),
            },
            'accounts': per_account,
        })
