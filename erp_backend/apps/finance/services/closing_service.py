"""
Closing Service — Façade for fiscal period close and year-end close.

Year-End Close Flow: verify periods posted → lock fiscal year → close
P&L into retained earnings → generate opening balances for next year →
open next fiscal year.

Heavy implementation lives in sibling `closing_*` modules (year impl,
integrity checks, snapshots, opening-balance generation/validation/
backfill, audit checks). They're re-attached to `ClosingService` as
static methods at the bottom of this module so every existing
`ClosingService.method_name(...)` caller keeps working unchanged.

Kept on the facade: period-level ops (close_fiscal_period, soft/hard
lock, reopen, soft_close_fiscal_year) and the close_fiscal_year
dry-run boundary that catches the `_DryRunComplete` sentinel.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class _DryRunComplete(Exception):
    """Sentinel raised at the end of a dry_run close to force the
    enclosing transaction.atomic() to roll back. Carries the preview
    payload so the outer boundary can hand it back to the caller."""
    def __init__(self, payload):
        self.payload = payload


class ClosingService:
    """Handles period and year-end close per SAP/Odoo/Oracle standards."""

    # Tolerance for reconciliation checks — accounts for rounding from
    # multi-line closing JEs with decimal splits. 1 cent is generous for
    # a well-behaved book of any size.
    _RECON_TOLERANCE = Decimal('0.01')

    @staticmethod
    def close_fiscal_period(organization, fiscal_period, user=None, dry_run=False):
        """
        Close a fiscal period. No further posting allowed after close.

        Enforces period-level parity of the year-close integrity gate:
          1. No DRAFT entries remain in the period
          2. Per-scope double-entry invariant (ΣDebit = ΣCredit) within the period
          3. Posting-guard check: no JE lines target a parent account
        After the gate passes:
          4. Refresh balance snapshots
          5. Capture hash-chained FiscalPeriodCloseSnapshot per scope
          6. Transition the period to CLOSED

        `dry_run=True` runs every check + simulates the snapshot capture,
        then rolls back. Returns a preview dict instead of the period row.
        """
        from apps.finance.models import JournalEntry
        from apps.finance.services.balance_service import BalanceService

        if fiscal_period.is_closed and not dry_run:
            return fiscal_period

        preview = {
            'dry_run': dry_run,
            'fiscal_period_id': fiscal_period.id,
            'fiscal_period_name': fiscal_period.name,
            'invariants_passed': False,
            'snapshots_captured': [],
            'messages': [],
        }

        def _run():
            # ── Invariant 1: no drafts ──
            draft_count = JournalEntry.objects.filter(
                organization=organization,
                fiscal_period=fiscal_period,
                status='DRAFT',
            ).count()
            if draft_count > 0:
                raise ValidationError(
                    f"Cannot close period {fiscal_period.name}: "
                    f"{draft_count} draft journal entries remain. "
                    f"Post or delete them first."
                )

            # ── Invariants 2 + 3: period-scoped double-entry + parent-posting check ──
            ClosingService._assert_period_integrity(organization, fiscal_period)

            # Refresh balance snapshots before closing
            BalanceService.refresh_snapshots(organization, fiscal_period, scope='OFFICIAL')
            BalanceService.refresh_snapshots(organization, fiscal_period, scope='INTERNAL')

            # Capture snapshots (one per scope) BEFORE state transition
            snaps = ClosingService._capture_period_snapshot(organization, fiscal_period, user)
            preview['snapshots_captured'] = snaps
            preview['invariants_passed'] = True

            if dry_run:
                raise _DryRunComplete(preview)

            # Close the period (canonical transition)
            fiscal_period.transition_to('CLOSED', user=user)

        try:
            with transaction.atomic():
                _run()
        except _DryRunComplete as done:
            return done.payload

            logger.info(
                f"ClosingService: Period {fiscal_period.name} closed by "
                f"{user.username if user else 'system'}"
            )
            return fiscal_period

    @staticmethod
    def soft_lock_period(organization, fiscal_period, user=None):
        """Soft-lock period — only supervisors can post."""
        fiscal_period.status = 'SOFT_LOCKED'
        fiscal_period.save()
        logger.info(f"ClosingService: Period {fiscal_period.name} soft-locked")
        return fiscal_period

    @staticmethod
    def hard_lock_period(organization, fiscal_period, user=None):
        """Hard-lock period — no posting allowed at all."""
        fiscal_period.status = 'HARD_LOCKED'
        fiscal_period.save()
        logger.info(f"ClosingService: Period {fiscal_period.name} hard-locked")
        return fiscal_period

    @staticmethod
    def reopen_period(organization, fiscal_period, user=None):
        """Reopen a closed/locked period. Requires superuser.

        Hard block: cannot reopen a period whose fiscal year is FINALIZED
        (or hard-locked). Finalization is an irreversible accounting act
        — reopening a period under it would leave the year technically
        closed while allowing new postings, which silently invalidates
        the CLOSING JE's P&L sweep. If the year really needs to be
        amended, the flow is: reverse the CLOSING JE → un-finalize →
        then reopen periods.
        """
        if user and not user.is_superuser:
            raise ValidationError("Only superusers can reopen fiscal periods.")

        fy = fiscal_period.fiscal_year
        if fy and (fy.status == 'FINALIZED' or fy.is_hard_locked):
            raise ValidationError(
                f"Cannot reopen period {fiscal_period.name}: fiscal year "
                f"{fy.name} is FINALIZED. Reverse the closing JE and "
                f"un-finalize the year first."
            )

        fiscal_period.transition_to('OPEN', user=user)
        logger.info(
            f"ClosingService: Period {fiscal_period.name} reopened by "
            f"{user.username if user else 'system'}"
        )
        return fiscal_period

    @staticmethod
    def soft_close_fiscal_year(organization, fiscal_year, user=None):
        """
        Soft close a fiscal year. Closes all standard periods but leaves the
        adjusting/audit period (13th month) and the year itself OPEN.
        """
        from apps.finance.models import JournalEntry
        from django.db.models import Q

        if fiscal_year.status in ['CLOSED', 'FINALIZED']:
            raise ValidationError(f"Fiscal year {fiscal_year.name} is already {fiscal_year.status}.")

        with transaction.atomic():
            periods_to_close = fiscal_year.periods.filter(is_closed=False).exclude(
                Q(is_adjustment_period=True) | Q(name__istartswith='Audit')
            )

            # Check for unposted entries in periods being closed
            draft_count = JournalEntry.objects.filter(
                organization=organization,
                fiscal_period__in=periods_to_close,
                status='DRAFT',
            ).count()

            if draft_count > 0:
                raise ValidationError(
                    f"Cannot soft-close year: {draft_count} draft journal entries remain "
                    f"in the periods being closed. Post or delete them first."
                )

            # Close the standard periods
            closed_count = 0
            for period in periods_to_close:
                period.transition_to('CLOSED', user=user)
                closed_count += 1

            # Transition the fiscal year itself to CLOSED
            fiscal_year.status = 'CLOSED'
            fiscal_year.save(update_fields=['status'])

            logger.info(
                f"ClosingService: Soft-closed {closed_count} periods for {fiscal_year.name} by "
                f"{user.username if user else 'system'}"
            )
            return fiscal_year

    @staticmethod
    def close_fiscal_year(organization, fiscal_year, user=None,
                          retained_earnings_account_id=None, close_date=None,
                          dry_run=False, override_checklist=False,
                          override_reason=None):
        """
        Full year-end close sequence.

        `dry_run=True` runs the entire close inside an atomic block,
        then raises a sentinel to force rollback. Returns a preview
        dict describing what WOULD have happened — every JE, every
        invariant, every snapshot — without any DB persistence. Real
        callers get the FiscalYear row as before.

        `override_checklist=True` lets a superuser proceed past unmet
        pre-close checklist items. The override is logged forensically
        and stamped on the run's notes; it is NOT silent. Requires
        ``user`` (the actor) and ``override_reason`` (audit text).

        Implementation: the public method is a thin wrapper that
        catches the sentinel. All work is delegated to
        `_close_fiscal_year_impl`, which raises on completion when
        dry_run=True. Kept split so `with transaction.atomic()` stays
        at a single indent level.
        """
        try:
            return ClosingService._close_fiscal_year_impl(
                organization, fiscal_year, user=user,
                retained_earnings_account_id=retained_earnings_account_id,
                close_date=close_date, dry_run=dry_run,
                override_checklist=override_checklist,
                override_reason=override_reason,
            )
        except _DryRunComplete as done:
            return done.payload


# ── Re-attach extracted standalone functions as static methods ──
# Imports are placed at the bottom of the module to avoid circular
# imports — the extracted modules need to import `ClosingService`
# itself (e.g. for `ClosingService._RECON_TOLERANCE`), so the class
# must be fully defined first.
from apps.finance.services.closing_year_impl import _close_fiscal_year_impl
from apps.finance.services.closing_integrity_checks import _assert_close_integrity
from apps.finance.services.closing_period_integrity import _assert_period_integrity
from apps.finance.services.closing_snapshot_service import (
    _capture_period_snapshot, _capture_close_snapshot,
)
from apps.finance.services.closing_snapshot_chain import verify_snapshot_chain
from apps.finance.services.closing_opening_generation import (
    generate_opening_balances, _create_opening_journal_entry,
)
from apps.finance.services.closing_opening_validation import (
    validate_opening_ob_vs_je, rebuild_ob_from_je,
)
from apps.finance.services.closing_opening_backfill import (
    backfill_opening_journal_entries,
)
from apps.finance.services.closing_audit_balance import (
    check_parent_purity, validate_balance_integrity,
)
from apps.finance.services.closing_audit_tax_fx import (
    check_tax_coverage, check_fx_integrity,
)
from apps.finance.services.closing_audit_subledger import (
    check_subledger_integrity, is_safe_to_flip_flag,
)

ClosingService._close_fiscal_year_impl = staticmethod(_close_fiscal_year_impl)
ClosingService._assert_close_integrity = staticmethod(_assert_close_integrity)
ClosingService._assert_period_integrity = staticmethod(_assert_period_integrity)
ClosingService._capture_period_snapshot = staticmethod(_capture_period_snapshot)
ClosingService._capture_close_snapshot = staticmethod(_capture_close_snapshot)
ClosingService.verify_snapshot_chain = staticmethod(verify_snapshot_chain)
ClosingService.generate_opening_balances = staticmethod(generate_opening_balances)
ClosingService._create_opening_journal_entry = staticmethod(_create_opening_journal_entry)
ClosingService.validate_opening_ob_vs_je = staticmethod(validate_opening_ob_vs_je)
ClosingService.rebuild_ob_from_je = staticmethod(rebuild_ob_from_je)
ClosingService.backfill_opening_journal_entries = staticmethod(backfill_opening_journal_entries)
ClosingService.check_parent_purity = staticmethod(check_parent_purity)
ClosingService.validate_balance_integrity = staticmethod(validate_balance_integrity)
ClosingService.check_tax_coverage = staticmethod(check_tax_coverage)
ClosingService.check_fx_integrity = staticmethod(check_fx_integrity)
ClosingService.check_subledger_integrity = staticmethod(check_subledger_integrity)
ClosingService.is_safe_to_flip_flag = staticmethod(is_safe_to_flip_flag)
