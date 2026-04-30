"""
Closing — Year-end close orchestrator (`_close_fiscal_year_impl`).

Owns the full year-end sequence:
  1. Verify all periods are closed (or partial close at close_date)
  2. Close P&L accounts into retained earnings
  3. Generate opening balances for the remainder year (or next year)
  4. Lock fiscal year
  5. Auto-create remainder year if close_date < fiscal_year.end_date

Heavy phases delegated to:
  - closing_year_helpers (FX precheck, orphan-JE backfill, RE resolution)
  - closing_year_partial.handle_partial_close (mid-year truncation)
  - closing_year_pnl_sweep.sweep_pnl_into_retained_earnings
  - closing_integrity_checks._assert_close_integrity
  - closing_snapshot_service._capture_close_snapshot
  - closing_opening_generation.generate_opening_balances

Re-attached to `ClosingService` as a static method by the facade.
"""
import logging
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


def _close_fiscal_year_impl(organization, fiscal_year, user=None,
                            retained_earnings_account_id=None,
                            close_date=None, dry_run=False,
                            override_checklist=False, override_reason=None):
    """Steps:
      1. Verify all periods are closed (or partial close at close_date)
      2. Close P&L accounts into retained earnings
      3. Generate opening balances for the remainder year (or next year)
      4. Lock fiscal year
      5. Auto-create remainder year if close_date is before fiscal_year.end_date
    """
    from apps.finance.models import FiscalYear
    from apps.finance.services.closing_service import (
        ClosingService, _DryRunComplete,
    )
    from apps.finance.services.closing_year_helpers import (
        check_fx_revaluation_pre_close,
        backfill_orphan_jes,
        resolve_retained_earnings_account,
    )
    from apps.finance.services.closing_year_partial import handle_partial_close
    from apps.finance.services.closing_year_pnl_sweep import (
        sweep_pnl_into_retained_earnings,
    )

    if fiscal_year.is_closed and not dry_run:
        raise ValidationError(f"Fiscal year {fiscal_year.name} is already closed.")
    if fiscal_year.is_closed and dry_run:
        # Dry-run on a closed year is still useful (what WOULD re-close look like?)
        # but skip the guard rather than silently returning nothing.
        pass

    # Preview accumulator — populated as the close runs so we can
    # hand a rich report back to the caller on dry_run=True.
    preview = {
        'dry_run': dry_run,
        'fiscal_year_id': fiscal_year.id,
        'fiscal_year_name': fiscal_year.name,
        'closing_jes': [],      # list of {scope, lines, total_debit, total_credit}
        'opening_jes': [],
        'messages': [],
        'invariants_passed': False,
        'snapshot_captured': False,
    }

    # Detect partial close: close_date is before fiscal_year.end_date
    is_partial = False
    if close_date:
        if isinstance(close_date, str):
            from django.utils.dateparse import parse_date
            close_date = parse_date(close_date)
        is_partial = close_date < fiscal_year.end_date

    with transaction.atomic():
        from apps.finance.models import JournalEntry as JE
        from django.db.models import Q
        # Match drafts by fiscal_year FK OR by transaction_date within range
        # (catches orphan JEs created before fiscal_year was assigned).
        yr_start = fiscal_year.start_date
        yr_end = close_date if is_partial else fiscal_year.end_date
        draft_count = JE.objects.filter(
            organization=organization,
            status='DRAFT',
        ).filter(
            Q(fiscal_year=fiscal_year) |
            Q(fiscal_year__isnull=True,
              transaction_date__date__gte=yr_start,
              transaction_date__date__lte=yr_end)
        ).count()
        if draft_count > 0:
            raise ValidationError(
                f"Cannot close year. {draft_count} draft journal entries remain "
                f"(includes orphan JEs by date). Post or delete them first."
            )

        check_fx_revaluation_pre_close(organization, fiscal_year, yr_end, preview)
        backfill_orphan_jes(organization, yr_start, yr_end)

        remainder_start = None
        remainder_end = None
        if is_partial:
            remainder_start, remainder_end = handle_partial_close(
                organization, fiscal_year, close_date, user
            )

        # Force-close all remaining periods
        unclosed = fiscal_year.periods.filter(is_closed=False)
        if unclosed.exists():
            unclosed_count = unclosed.count()
            unclosed.update(status='CLOSED', is_closed=True, closed_at=timezone.now(), closed_by=user)
            logger.info(
                f"ClosingService: Auto-closed {unclosed_count} periods for {fiscal_year.name}"
            )

        # ── Step 2: Resolve retained earnings account ──────────
        re_account = resolve_retained_earnings_account(
            organization, retained_earnings_account_id
        )

        # ── Step 3: Close P&L into retained earnings ───────────
        sweep_pnl_into_retained_earnings(
            organization, fiscal_year, re_account, user, preview, dry_run
        )

        # ── Step 4: Resolve next fiscal year ──
        if is_partial and remainder_start and remainder_end:
            # Look for a year covering the remainder (auto-created during
            # partial-close handler OR user-created beforehand). Exclude
            # the FY being closed: its full range trivially overlaps the
            # remainder window.
            next_year = (
                FiscalYear.objects
                .filter(
                    organization=organization,
                    start_date__lte=remainder_end,
                    end_date__gte=remainder_start,
                )
                .exclude(id=fiscal_year.id)
                .first()
            )
            if not next_year:
                logger.warning(
                    f"ClosingService: Partial close of {fiscal_year.name} leaves uncovered "
                    f"range {remainder_start} → {remainder_end}. No remainder year exists. "
                    f"Opening balances NOT generated."
                )
        else:
            next_year = FiscalYear.objects.filter(
                organization=organization,
                start_date__gt=fiscal_year.end_date,
            ).order_by('start_date').first()

        if next_year:
            ClosingService.generate_opening_balances(
                organization, fiscal_year, next_year, user=user
            )
            if dry_run:
                from apps.finance.models import JournalEntryLine
                from django.db.models import Sum
                for scope in ('OFFICIAL', 'INTERNAL'):
                    ob_lines = JournalEntryLine.objects.filter(
                        organization=organization,
                        journal_entry__fiscal_year=next_year,
                        journal_entry__journal_type='OPENING',
                        journal_entry__journal_role='SYSTEM_OPENING',
                        journal_entry__scope=scope,
                        journal_entry__is_superseded=False,
                    )
                    cnt = ob_lines.count()
                    agg = ob_lines.aggregate(d=Sum('debit'), c=Sum('credit'))
                    if cnt:
                        preview['opening_jes'].append({
                            'scope': scope,
                            'target_year': next_year.name,
                            'lines': cnt,
                            'total_debit': str(agg['d'] or 0),
                            'total_credit': str(agg['c'] or 0),
                        })
        else:
            logger.warning(
                f"ClosingService: No next fiscal year found after {fiscal_year.name}. "
                f"Opening balances not generated. Create next year first."
            )
            if dry_run:
                preview['messages'].append(
                    f"No next fiscal year after {fiscal_year.name} — opening JEs would be skipped."
                )

        # ── Pre-close checklist gate (opt-in) ────────────────────
        # Refuse finalize until every required task is marked complete.
        # Deployments without a checklist template are unaffected.
        # Superuser override stamps a forensic record.
        try:
            from apps.finance.services.close_checklist_service import (
                CloseChecklistService,
            )
            CloseChecklistService.validate_ready_for_year(
                organization, fiscal_year,
                override=override_checklist,
                override_user=user if override_checklist else None,
                override_reason=override_reason if override_checklist else None,
            )
        except ImportError:
            pass  # module not loaded — skip silently

        # ── Reconciliation gate (pre-finalize) ────────────────────
        # Closing is permanent. If the closing JEs didn't actually zero
        # P&L or if the books don't balance, we must NOT mark the year
        # FINALIZED — rollback instead (transaction.atomic wraps the
        # entire method, so raising here undoes everything).
        ClosingService._assert_close_integrity(
            organization, fiscal_year, next_year
        )

        # ── Step 4.5: Capture close snapshot ─────────────────────
        # Immutable trial-balance snapshot per scope. Runs AFTER the
        # integrity gate so we never persist a snapshot of a broken
        # close; the gate raises on failure and the atomic block
        # rolls back everything, including the snapshot row.
        ClosingService._capture_close_snapshot(
            organization, fiscal_year, user=user
        )

        preview['invariants_passed'] = True
        preview['snapshot_captured'] = True

        # ── Step 5: Mark fiscal year FINALIZED ────────────────────
        # Transition lattice is OPEN → CLOSED → FINALIZED; bridge via
        # CLOSED when the caller hit finalize directly on an open year.
        if not dry_run:
            if fiscal_year.status == 'OPEN':
                fiscal_year.transition_to('CLOSED', user=user)
            fiscal_year.transition_to('FINALIZED', user=user)

            logger.info(
                f"ClosingService: Fiscal year {fiscal_year.name} finalized by "
                f"{user.username if user else 'system'}"
            )
            return fiscal_year

        # ── Dry-run terminator ──
        # All invariants passed, JEs wrote, snapshot captured, status
        # would transition. Raise to roll the atomic block back and
        # surface the preview to the outer boundary.
        preview['final_status'] = 'FINALIZED (simulated)'
        preview['messages'].insert(
            0, 'Dry-run complete — all invariants passed. No changes persisted.'
        )
        raise _DryRunComplete(preview)
