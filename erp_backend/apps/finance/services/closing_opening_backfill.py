"""
Closing — Opening Journal Entry backfill (historical OB → JE migration).

One-shot tool to bring pre-Phase-2 fiscal years under the JE-only model
by creating SYSTEM_OPENING journal entries from existing OpeningBalance
rows. Extracted from `closing_service.py` for the 300-line maintainability
ceiling. Re-attached to `ClosingService` as a static method by the facade.
"""
import logging
from decimal import Decimal
from django.db import transaction

logger = logging.getLogger(__name__)


def backfill_opening_journal_entries(organization, user=None, dry_run=False, force=False):
    """
    Backfill OPENING journal entries for every fiscal year that has
    OpeningBalance rows but no corresponding OPENING JE. Used to bring
    historical data under the JE-only model (Phase 1 of the migration).

    Idempotent — re-running is safe. Reads from OpeningBalance, writes
    OPENING JEs. Does not touch OB rows.

    Args:
      organization: Organization to process
      user: User to attribute the JE creation to (optional)
      dry_run: If True, returns counts without creating JEs

    Returns: dict with per-year/per-scope counts and any skipped reasons.
    """
    from apps.finance.models import OpeningBalance, FiscalYear, JournalEntry
    from apps.finance.services.closing_opening_generation import (
        _create_opening_journal_entry,
    )
    from django.db.models import Count, Q

    report = {
        'years_processed': 0,
        'scopes_created': 0,
        'scopes_skipped': 0,
        'details': [],
    }

    # Group OB rows by (fiscal_year, scope). Each group becomes one JE.
    fy_scope_pairs = (
        OpeningBalance.objects
        .filter(organization=organization)
        .values('fiscal_year', 'scope')
        .annotate(n=Count('id'))
        .order_by('fiscal_year', 'scope')
    )

    for pair in fy_scope_pairs:
        fy_id = pair['fiscal_year']
        scope = pair['scope']
        try:
            fiscal_year = FiscalYear.objects.get(id=fy_id, organization=organization)
        except FiscalYear.DoesNotExist:
            report['scopes_skipped'] += 1
            report['details'].append({
                'fy_id': fy_id, 'scope': scope,
                'skipped_reason': 'fiscal_year deleted',
            })
            continue

        # Skip if a valid (POSTED) OPENING JE already exists, unless
        # force=True (user knows the existing JE is stale and wants
        # to regenerate). `_create_opening_journal_entry` will
        # soft-supersede the current live JE, so the history is
        # preserved either way.
        already = JournalEntry.objects.filter(
            organization=organization,
            fiscal_year=fiscal_year,
            journal_type='OPENING',
            scope=scope,
            source_model='FiscalYear',
            source_id=fiscal_year.id,
            status='POSTED',
            is_superseded=False,
        ).exists()
        if already and not force:
            report['scopes_skipped'] += 1
            report['details'].append({
                'fy_id': fy_id, 'scope': scope, 'fy_name': fiscal_year.name,
                'skipped_reason': 'opening JE already exists (pass force=True to regenerate)',
            })
            continue

        # Build line dicts from OB rows for this (year, scope).
        ob_rows = OpeningBalance.objects.filter(
            organization=organization,
            fiscal_year=fiscal_year,
            scope=scope,
        ).select_related('account')
        lines = [
            {
                'account_id': ob.account_id,
                'account_code': ob.account.code,
                'account_name': ob.account.name,
                'debit': ob.debit_amount or Decimal('0.00'),
                'credit': ob.credit_amount or Decimal('0.00'),
            }
            for ob in ob_rows
            if (ob.debit_amount or Decimal('0.00')) != Decimal('0.00')
            or (ob.credit_amount or Decimal('0.00')) != Decimal('0.00')
        ]

        if dry_run:
            report['scopes_created'] += 1
            report['details'].append({
                'fy_id': fy_id, 'scope': scope, 'fy_name': fiscal_year.name,
                'would_create_lines': len(lines),
            })
            continue

        with transaction.atomic():
            je = _create_opening_journal_entry(
                organization=organization,
                fiscal_year=fiscal_year,
                scope=scope,
                lines=lines,
                source_year_name='historical OB backfill',
                user=user,
            )
        if je:
            report['scopes_created'] += 1
            report['details'].append({
                'fy_id': fy_id, 'scope': scope, 'fy_name': fiscal_year.name,
                'lines': len(lines), 'je_id': je.id,
            })
        else:
            report['scopes_skipped'] += 1
            report['details'].append({
                'fy_id': fy_id, 'scope': scope, 'fy_name': fiscal_year.name,
                'skipped_reason': 'out of balance — see error log',
            })

    report['years_processed'] = len({d.get('fy_id') for d in report['details']})
    logger.info(
        f"ClosingService.backfill_opening_journal_entries: "
        f"processed {report['years_processed']} years, "
        f"created {report['scopes_created']} JEs, "
        f"skipped {report['scopes_skipped']} (dry_run={dry_run})"
    )
    return report
