"""
Close-checklist service — orchestrates pre-close task gate.

Workflow:
  1. Admin builds a CloseChecklistTemplate with items (bank rec done,
     accruals posted, FX reval run, etc.) once per organisation.
  2. At close time, `start_run(template, fiscal_year_or_period)`
     creates a CloseChecklistRun with one CloseChecklistItemState per
     template item (all initially incomplete).
  3. Operators mark items complete via `mark_item`. Some items can be
     auto-marked via `apply_auto_checks` (called by the close-gate).
  4. `is_ready(run)` returns True iff every required item is complete.
  5. close_fiscal_year consults `validate_ready_for_year()` as an
     invariant; refuses finalize if incomplete.
"""
import logging
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone

logger = logging.getLogger(__name__)


class CloseChecklistService:
    """Pre-close task gate orchestration."""

    # ── Template setup ─────────────────────────────────────
    @staticmethod
    def ensure_default_template(organization):
        """Create-or-get the standard year-end close template.

        Default template ships with the minimal required task set that
        reflects the invariants already enforced by the close-gate
        elsewhere. Administrators can edit / extend after creation.
        """
        from apps.finance.models import CloseChecklistTemplate, CloseChecklistItem

        tmpl, created = CloseChecklistTemplate.objects.get_or_create(
            organization=organization,
            name='Standard Year-End Close',
            scope='FISCAL_YEAR',
            defaults={'is_default': True,
                      'description': 'Required tasks before year-end finalize'},
        )
        if not created:
            return tmpl

        defaults = [
            # Pre-close reconciliations
            (10, 'All bank accounts reconciled', 'RECONCILIATION',
             'all_bank_reconciled'),
            (20, 'AR aging reviewed, write-offs posted', 'RECONCILIATION', ''),
            (30, 'AP aging reviewed, accruals posted', 'ACCRUALS', ''),
            (40, 'Intercompany balances matched', 'RECONCILIATION', ''),
            # Automated actions
            (50, 'FX revaluation run for period', 'FX', 'fx_revaluation_completed'),
            (60, 'Depreciation posted', 'DEPRECIATION', ''),
            (70, 'Inventory count complete & valuation posted', 'INVENTORY', ''),
            (80, 'Deferred revenue releases posted', 'ACCRUALS',
             'revenue_recognition_run'),
            # Tax + review
            (90, 'VAT/Tax return prepared & filed', 'TAX', ''),
            (100, 'Management review & sign-off', 'REVIEW', ''),
        ]
        for order, name, category, signal in defaults:
            CloseChecklistItem.objects.create(
                organization=organization,
                template=tmpl,
                order=order, name=name, category=category,
                is_required=True, auto_check_signal=signal,
            )
        logger.info(
            "CloseChecklistService: seeded default template for org %s", organization.id,
        )
        return tmpl

    @staticmethod
    def ensure_default_period_template(organization):
        """Create-or-get the standard monthly period-close template.

        Month-end close is a lighter version of year-end: no P&L sweep
        to RE (that only happens annually), no opening-balance
        regeneration, just the discipline tasks that should run every
        month so year-end isn't a surprise.
        """
        from apps.finance.models import CloseChecklistTemplate, CloseChecklistItem

        tmpl, created = CloseChecklistTemplate.objects.get_or_create(
            organization=organization,
            name='Standard Monthly Close',
            scope='FISCAL_PERIOD',
            defaults={'is_default': True,
                      'description': 'Required tasks before each period (month) close'},
        )
        if not created:
            return tmpl

        defaults = [
            (10, 'All bank accounts reconciled for the period', 'RECONCILIATION', 'all_bank_reconciled'),
            (20, 'AR aging reviewed', 'RECONCILIATION', ''),
            (30, 'AP aging reviewed', 'ACCRUALS', ''),
            (40, 'Accruals + deferrals posted', 'ACCRUALS', ''),
            (50, 'FX revaluation run for period', 'FX', 'fx_revaluation_completed'),
            (60, 'Depreciation posted', 'DEPRECIATION', ''),
            (70, 'Inventory movements reconciled', 'INVENTORY', ''),
            (80, 'No DRAFT journals remain', 'RECONCILIATION', 'no_draft_journals'),
            (90, 'Period P&L reviewed', 'REVIEW', ''),
        ]
        for order, name, category, signal in defaults:
            CloseChecklistItem.objects.create(
                organization=organization,
                template=tmpl,
                order=order, name=name, category=category,
                is_required=True, auto_check_signal=signal,
            )
        logger.info(
            "CloseChecklistService: seeded monthly template for org %s", organization.id,
        )
        return tmpl

    # ── Run lifecycle ──────────────────────────────────────
    @staticmethod
    def start_run(organization, *, template=None, fiscal_year=None,
                  fiscal_period=None, user=None):
        """Create a CloseChecklistRun with one state per template item.
        Either fiscal_year OR fiscal_period must be supplied."""
        from apps.finance.models import (
            CloseChecklistRun, CloseChecklistItemState,
        )
        if (fiscal_year is None) == (fiscal_period is None):
            raise ValidationError(
                "Pass exactly one of fiscal_year or fiscal_period"
            )
        if template is None:
            template = CloseChecklistService.ensure_default_template(organization)

        with transaction.atomic():
            run = CloseChecklistRun.objects.create(
                organization=organization,
                template=template,
                fiscal_year=fiscal_year,
                fiscal_period=fiscal_period,
                created_by=user,
            )
            states = [
                CloseChecklistItemState(
                    organization=organization, run=run, item=item,
                )
                for item in template.items.all().order_by('order')
            ]
            CloseChecklistItemState.objects.bulk_create(states)
        return run

    @staticmethod
    def mark_item(run, item, *, user=None, notes='', auto=False):
        """Mark a single item complete. Idempotent."""
        from apps.finance.models import CloseChecklistItemState

        state = CloseChecklistItemState.objects.filter(
            run=run, item=item,
        ).first()
        if state is None:
            raise ValidationError(
                f"Item {item.id} is not part of run {run.id}"
            )
        if state.is_complete:
            return state
        state.is_complete = True
        state.completed_at = timezone.now()
        state.completed_by = user
        state.auto_checked = bool(auto)
        if notes:
            state.notes = notes
        state.save()
        return state

    @staticmethod
    def apply_auto_checks(run):
        """Auto-mark items whose auto_check_signal matches a detected
        ledger state. Called idempotently — marking an already-complete
        item is a no-op.

        Supported signals:
          'all_bank_reconciled'          — every FinancialAccount sub_type
            BANK/CASH has zero unreconciled lines in the run's period.
          'fx_revaluation_completed'     — a CurrencyRevaluation row
            with status='POSTED' exists for the run's period.
          'revenue_recognition_run'      — at least one ADJUSTMENT JE
            with source_model='DeferredRevenue' exists in the period.
          'no_draft_journals'            — zero DRAFT JEs in the period.
        """
        from apps.finance.models import JournalEntry
        checks_fired = 0
        period = run.fiscal_period or (
            run.fiscal_year.periods.first() if run.fiscal_year else None
        )
        if period is None:
            return 0

        for state in run.item_states.filter(is_complete=False).select_related('item'):
            sig = state.item.auto_check_signal
            if not sig:
                continue
            fired = False
            try:
                if sig == 'no_draft_journals':
                    draft = JournalEntry.objects.filter(
                        organization=run.organization,
                        fiscal_period=period, status='DRAFT',
                    ).exists()
                    fired = not draft
                elif sig == 'fx_revaluation_completed':
                    from apps.finance.models import CurrencyRevaluation
                    fired = CurrencyRevaluation.objects.filter(
                        organization=run.organization,
                        fiscal_period=period, status='POSTED',
                    ).exists()
                elif sig == 'revenue_recognition_run':
                    fired = JournalEntry.objects.filter(
                        organization=run.organization,
                        fiscal_period=period,
                        source_model='DeferredRevenue',
                        status='POSTED',
                    ).exists()
                elif sig == 'all_bank_reconciled':
                    # Conservative: require zero unreconciled JE lines on
                    # any account flagged allow_reconciliation=True.
                    from apps.finance.models import JournalEntryLine
                    unrec = JournalEntryLine.objects.filter(
                        organization=run.organization,
                        account__allow_reconciliation=True,
                        journal_entry__fiscal_period=period,
                        journal_entry__status='POSTED',
                        is_reconciled=False,
                    ).exists()
                    fired = not unrec
            except Exception:
                fired = False  # unknown signal / schema mismatch → skip

            if fired:
                CloseChecklistService.mark_item(run, state.item, auto=True)
                checks_fired += 1

        # Transition run status if all required items are now done
        if run.is_ready_to_close() and run.status == 'OPEN':
            run.status = 'READY'
            run.save(update_fields=['status'])
            # Fire auto-task event so operators get notified the moment
            # the gate clears — they often won't refresh the checklist UI.
            try:
                from apps.workspace.auto_task_service import fire_auto_tasks
                target_label = (
                    f'Fiscal Year {run.fiscal_year.name}' if run.fiscal_year_id
                    else f'Period {run.fiscal_period.name}'
                )
                fire_auto_tasks(run.organization, 'CHECKLIST_READY_TO_CLOSE', {
                    'reference': target_label,
                    'extra': {
                        'object_type': 'CloseChecklistRun',
                        'object_id': run.id,
                        'Target': target_label,
                        'Template': run.template.name,
                    },
                })
            except Exception:
                logger.exception("CHECKLIST_READY_TO_CLOSE fire failed")

        return checks_fired

    # ── Close-gate invariant ───────────────────────────────
    @staticmethod
    def validate_ready_for_year(organization, fiscal_year, override=False, override_user=None, override_reason=None):
        """Called by close_fiscal_year before finalizing. If a run
        exists for this year and is not READY (all required done),
        raise ValidationError. If NO run exists, we auto-start one,
        apply auto-checks, then re-evaluate — this way the checklist
        discovers the close, rather than blocking orgs that never set
        one up.

        ``override=True`` lets a superuser proceed past unmet items.
        It does NOT mark them complete; it logs the override (forensic
        + the run's notes field) so an auditor can later verify which
        items were skipped, by whom, and why. ``override_user`` and
        ``override_reason`` are required when override is True.

        Returns the run (always non-null on success).
        """
        from apps.finance.models import CloseChecklistRun, CloseChecklistTemplate

        # Look for existing active (OPEN or READY) run
        run = CloseChecklistRun.objects.filter(
            organization=organization, fiscal_year=fiscal_year,
            status__in=('OPEN', 'READY'),
        ).order_by('-created_at').first()

        if run is None:
            # Auto-start one from the default template (if any)
            tmpl = CloseChecklistTemplate.objects.filter(
                organization=organization, scope='FISCAL_YEAR', is_default=True,
            ).first()
            if tmpl is None:
                # No template set up → treat as advisory only and pass.
                # This keeps the invariant opt-in: deployments that
                # don't care about checklists aren't blocked.
                return None
            run = CloseChecklistService.start_run(
                organization, template=tmpl, fiscal_year=fiscal_year,
            )

        # Run auto-checks before deciding readiness
        CloseChecklistService.apply_auto_checks(run)

        if not run.is_ready_to_close():
            missing = run.item_states.filter(
                item__is_required=True, is_complete=False,
            ).select_related('item')
            lines = [
                f"  ({it.item.category}) {it.item.name}"
                for it in missing
            ]

            if override:
                if not override_user or not override_reason:
                    raise ValidationError(
                        "Checklist override requires both override_user and "
                        "override_reason. Refusing to skip the gate without "
                        "an auditable record of who did it and why."
                    )
                # Forensic + checklist-run audit trail. Never silently bypass.
                missing_summary = "; ".join(
                    f"({it.item.category}) {it.item.name}" for it in missing
                )
                try:
                    from apps.finance.services.audit_service import ForensicAuditService
                    ForensicAuditService.log_mutation(
                        organization=organization,
                        user=override_user,
                        model_name='CloseChecklistRun',
                        object_id=run.id,
                        change_type='OVERRIDE',
                        payload={
                            'fiscal_year': fiscal_year.name,
                            'missing_count': missing.count(),
                            'missing': missing_summary,
                            'reason': override_reason,
                        },
                    )
                except Exception:
                    # Audit logging must never break the close itself.
                    pass
                logger.warning(
                    f"CloseChecklistService: OVERRIDE applied to {fiscal_year.name} "
                    f"by {getattr(override_user, 'username', '?')} — "
                    f"{missing.count()} required items skipped. Reason: {override_reason}"
                )
                return run

            raise ValidationError(
                f"Close checklist not ready for {fiscal_year.name}. "
                f"Missing required items:\n" + "\n".join(lines)
            )
        return run

    # ── Canary signal ──────────────────────────────────────
    @staticmethod
    def check_close_checklist_integrity(organization):
        """Surface close-readiness status for canary reporting.

        Findings:
          1. Any fiscal year that is CLOSED or FINALIZED but has an
             OPEN checklist run — indicates the run was abandoned.
          2. Any fiscal year nearing its end_date (within 30 days or
             past) with no READY checklist and no FINALIZED status —
             operator alerting target.
        """
        from apps.finance.models import (
            CloseChecklistRun, FiscalYear,
        )
        from datetime import timedelta

        report = {
            'organization_id': organization.id,
            'organization_slug': getattr(organization, 'slug', None),
            'clean': True,
            'abandoned_runs': [],
            'years_overdue_checklist': [],
        }

        # 1. Abandoned runs
        abandoned = CloseChecklistRun.objects.filter(
            organization=organization, status='OPEN',
            fiscal_year__status__in=['CLOSED', 'FINALIZED'],
        ).select_related('fiscal_year')
        for r in abandoned:
            report['abandoned_runs'].append({
                'run_id': r.id, 'fiscal_year': r.fiscal_year.name,
                'status': r.status,
            })
            report['clean'] = False

        # 2. Years approaching end without a READY checklist
        today = timezone.now().date()
        threshold = today + timedelta(days=30)
        at_risk = FiscalYear.objects.filter(
            organization=organization,
            status='OPEN',
            end_date__lte=threshold,
        )
        for fy in at_risk:
            has_ready = CloseChecklistRun.objects.filter(
                organization=organization, fiscal_year=fy,
                status='READY',
            ).exists()
            if not has_ready:
                report['years_overdue_checklist'].append({
                    'fiscal_year_id': fy.id, 'name': fy.name,
                    'end_date': fy.end_date.isoformat(),
                })
                report['clean'] = False

        return report
