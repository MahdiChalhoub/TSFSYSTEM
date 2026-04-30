"""
FiscalYearViewSet mixin — `snapshot_chain`.

Verifies the full hash-chained snapshot history for the org (year +
period snapshots merged chronologically). Inherited by
`FiscalYearViewSet`.
"""
from .base import (
    Response, action,
    get_current_tenant_id,
)


class FiscalYearSnapshotChainMixin:
    """@action method: snapshot_chain."""

    @action(detail=False, methods=['get'], url_path='snapshot-chain')
    def snapshot_chain(self, request):
        """Return the full hash-chained snapshot history for this org.

        Merges FiscalYearCloseSnapshot + FiscalPeriodCloseSnapshot into
        one chronologically-ordered list and verifies each row:
          • content_hash matches a fresh recompute → intact ✓
          • stored prev_hash equals the previous row's stored
            content_hash → chain unbroken ✓

        Response shape:
          {
            'rows_checked': int, 'breaks': int, 'clean': bool,
            'chain': [
              {'kind':'year'|'period', 'id', 'label', 'scope',
               'captured_at', 'content_hash', 'prev_hash',
               'status':'intact'|'content_drift'|'chain_break',
               'recomputed_hash' (only if drift),
               'expected_prev' (only if break)},
              ...
            ],
          }
        """
        from apps.finance.models import (
            FiscalYearCloseSnapshot, FiscalPeriodCloseSnapshot,
        )

        organization_id = get_current_tenant_id()

        year_rows = list(
            FiscalYearCloseSnapshot.objects
            .filter(organization_id=organization_id)
            .select_related('fiscal_year')
            .order_by('captured_at', 'id')
        )
        period_rows = list(
            FiscalPeriodCloseSnapshot.objects
            .filter(organization_id=organization_id)
            .select_related('fiscal_period')
            .order_by('captured_at', 'id')
        )

        # Merge by captured_at (+ 'id' for stable tiebreak)
        merged = []
        for s in year_rows:
            merged.append(('year', s))
        for s in period_rows:
            merged.append(('period', s))
        merged.sort(key=lambda pair: (pair[1].captured_at, pair[1].id))

        chain = []
        expected_prev = None
        breaks = 0

        for kind, s in merged:
            recomputed = s.compute_content_hash()
            content_drift = s.content_hash != recomputed
            chain_break = s.prev_hash != expected_prev

            row_status = 'intact'
            extra = {}
            if content_drift:
                row_status = 'content_drift'
                extra['recomputed_hash'] = recomputed
                breaks += 1
            elif chain_break:
                row_status = 'chain_break'
                extra['expected_prev'] = expected_prev
                breaks += 1

            label = (
                s.fiscal_year.name if kind == 'year'
                else s.fiscal_period.name
            )
            chain.append({
                'kind': kind,
                'id': s.id,
                'label': label,
                'scope': s.scope,
                'captured_at': s.captured_at.isoformat() if s.captured_at else None,
                'content_hash': s.content_hash,
                'prev_hash': s.prev_hash,
                'status': row_status,
                **extra,
            })
            # Walk using STORED hash — not recomputed — so mid-chain
            # tampering cascades and we detect it on subsequent rows too.
            expected_prev = s.content_hash

        return Response({
            'rows_checked': len(chain),
            'breaks': breaks,
            'clean': breaks == 0,
            'chain': chain,
        })
