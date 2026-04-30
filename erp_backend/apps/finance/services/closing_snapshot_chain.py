"""
Closing Snapshot Chain — hash-chain verification for FiscalYearCloseSnapshot.

Read-only walker. Extracted from `closing_service.py` for the 300-line
maintainability ceiling. Re-attached to `ClosingService` as a static
method by the facade.
"""
import logging

logger = logging.getLogger(__name__)


def verify_snapshot_chain(organization):
    """Walk the FiscalYearCloseSnapshot hash chain for this org and
    confirm:
      1. Each row's content_hash matches a fresh recompute of its
         canonical payload (no silent field mutation).
      2. Each row's prev_hash matches the content_hash of its
         predecessor in capture-time order (no re-ordering / insert /
         delete of an earlier snapshot).

    Returns:
      {
        'organization_id', 'organization_slug',
        'clean': bool, 'rows_checked': int,
        'breaks': [
          {'snapshot_id', 'fiscal_year_id', 'scope',
           'kind': 'content_drift' | 'chain_break',
           'stored_hash', 'computed_hash',
           'stored_prev', 'expected_prev'},
          ...
        ],
      }
    """
    from apps.finance.models import FiscalYearCloseSnapshot

    report = {
        'organization_id': organization.id,
        'organization_slug': getattr(organization, 'slug', None),
        'clean': True,
        'rows_checked': 0,
        'breaks': [],
    }

    chain = list(
        FiscalYearCloseSnapshot.objects
        .filter(organization=organization)
        .order_by('captured_at', 'id')
    )
    expected_prev = None
    for s in chain:
        report['rows_checked'] += 1

        # 1) Content integrity — recompute and compare.
        recomputed = s.compute_content_hash()
        if s.content_hash != recomputed:
            report['breaks'].append({
                'snapshot_id': s.id,
                'fiscal_year_id': s.fiscal_year_id,
                'scope': s.scope,
                'kind': 'content_drift',
                'stored_hash': s.content_hash,
                'computed_hash': recomputed,
                'stored_prev': s.prev_hash,
                'expected_prev': expected_prev,
            })
            report['clean'] = False

        # 2) Chain integrity — the prev_hash must point at the
        # content_hash of the previous snapshot in capture order.
        if s.prev_hash != expected_prev:
            report['breaks'].append({
                'snapshot_id': s.id,
                'fiscal_year_id': s.fiscal_year_id,
                'scope': s.scope,
                'kind': 'chain_break',
                'stored_hash': s.content_hash,
                'computed_hash': recomputed,
                'stored_prev': s.prev_hash,
                'expected_prev': expected_prev,
            })
            report['clean'] = False

        # Walk forward using the STORED content_hash (not the
        # recomputed one) — mid-chain tampering would otherwise be
        # silently patched over when computing the next expected_prev.
        expected_prev = s.content_hash

    return report
