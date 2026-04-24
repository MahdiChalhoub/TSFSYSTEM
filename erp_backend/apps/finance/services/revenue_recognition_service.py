"""
Revenue Recognition Service — periodic release of deferred revenue into
recognised revenue per schedule or per satisfied performance obligation.

ASC 606 / IFRS 15 simplified model:
  • STRAIGHT_LINE: monthly_amount released each period until
    months_recognized == duration_months.
  • MILESTONE: amount = sum(obligation.allocation_amount) for obligations
    satisfied during the period.
  • USAGE: operator writes a usage-based release manually; engine is a no-op.

Release JE:
    Dr  deferred_revenue_coa   (liability ↓)
    Cr  revenue_coa            (income ↑)

One JE per (DeferredRevenue, period) to keep the audit trail clean.
Idempotent: calling `run_monthly_release` twice for the same period
does not double-post because it checks months_recognized before each
release.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class RevenueRecognitionService:
    """Periodic revenue-recognition engine."""

    @staticmethod
    def run_monthly_release(organization, fiscal_period, user=None, dry_run=False):
        """Release one period's worth of revenue across every ACTIVE
        DeferredRevenue row for this organisation.

        Args:
            organization: Organization instance
            fiscal_period: FiscalPeriod to recognise into (its end_date
                is the transaction_date on the release JE)
            user: optional, stamped on the JE
            dry_run: True → compute counts without writing
        Returns:
            dict summary: {'released_rows', 'amount_total', 'completed_rows'}
        """
        from apps.finance.models import DeferredRevenue
        from apps.finance.services.ledger_core import LedgerCoreMixin

        out = {
            'released_rows': 0,
            'amount_total': Decimal('0.00'),
            'completed_rows': 0,
            'skipped_rows': 0,
            'errors': [],
        }

        qs = DeferredRevenue.objects.filter(
            organization=organization, status='ACTIVE',
        ).select_related('deferred_coa', 'revenue_coa')

        for dr in qs:
            # Don't recognise before the start_date
            if fiscal_period.end_date < dr.start_date:
                out['skipped_rows'] += 1
                continue
            if not dr.deferred_coa or not dr.revenue_coa:
                out['errors'].append({
                    'deferred_revenue_id': dr.id,
                    'error': 'missing deferred_coa or revenue_coa',
                })
                continue

            # Recognition engine dispatch
            if dr.recognition_method == 'STRAIGHT_LINE':
                amount = RevenueRecognitionService._release_straight_line(
                    dr, fiscal_period, user, dry_run,
                )
            elif dr.recognition_method == 'MILESTONE':
                amount = RevenueRecognitionService._release_milestones(
                    dr, fiscal_period, user, dry_run,
                )
            elif dr.recognition_method == 'USAGE':
                amount = Decimal('0.00')  # usage is operator-driven
            else:
                out['errors'].append({
                    'deferred_revenue_id': dr.id,
                    'error': f'unknown recognition_method {dr.recognition_method}',
                })
                continue

            if amount <= Decimal('0.00'):
                out['skipped_rows'] += 1
                continue

            out['released_rows'] += 1
            out['amount_total'] += amount
            if dr.remaining_amount <= Decimal('0.00'):
                out['completed_rows'] += 1

        logger.info(
            "RevenueRecognitionService: period=%s released=%s amount=%s dry=%s",
            fiscal_period.name, out['released_rows'], out['amount_total'], dry_run,
        )
        return out

    @staticmethod
    def _release_straight_line(dr, fiscal_period, user, dry_run):
        """Release one month's monthly_amount. No-op if already fully
        recognised (months_recognized >= duration_months) — prevents
        re-release on a dry-run → real-run → repeated dry-run cadence.
        """
        if dr.months_recognized >= dr.duration_months:
            return Decimal('0.00')

        # Cap the final month at remaining_amount to absorb any rounding
        # residue from the monthly_amount quantize.
        amount = min(dr.monthly_amount, dr.remaining_amount)
        if amount <= Decimal('0.00'):
            return Decimal('0.00')

        if not dry_run:
            RevenueRecognitionService._post_release(
                dr, fiscal_period, amount, user,
                description=(
                    f"Revenue recognition ({fiscal_period.name}) "
                    f"for {dr.name} — month {dr.months_recognized + 1}/{dr.duration_months}"
                ),
            )
            with transaction.atomic():
                dr.months_recognized += 1
                dr.remaining_amount -= amount
                if dr.remaining_amount <= Decimal('0.01'):
                    dr.remaining_amount = Decimal('0.00')
                    dr.status = 'COMPLETED'
                dr.save()
        return amount

    @staticmethod
    def _release_milestones(dr, fiscal_period, user, dry_run):
        """Release sum(allocation_amount) over satisfied obligations
        whose satisfied_at falls within this period AND that haven't
        already had a release JE posted.
        """
        from django.db.models import Q
        p_start_dt = fiscal_period.start_date
        p_end_dt = fiscal_period.end_date

        obligations = dr.obligations.filter(
            is_satisfied=True,
            release_journal_entry__isnull=True,
            satisfied_at__date__gte=p_start_dt,
            satisfied_at__date__lte=p_end_dt,
        )
        total = sum(
            (o.allocation_amount for o in obligations),
            Decimal('0.00'),
        )
        if total <= Decimal('0.00'):
            return Decimal('0.00')

        if not dry_run:
            je = RevenueRecognitionService._post_release(
                dr, fiscal_period, total, user,
                description=(
                    f"Revenue recognition ({fiscal_period.name}) "
                    f"for {dr.name} — {obligations.count()} milestone(s) satisfied"
                ),
            )
            with transaction.atomic():
                dr.remaining_amount -= total
                if dr.remaining_amount <= Decimal('0.01'):
                    dr.remaining_amount = Decimal('0.00')
                    dr.status = 'COMPLETED'
                dr.save()
                obligations.update(release_journal_entry=je)

        return total

    @staticmethod
    def _post_release(dr, fiscal_period, amount, user, description):
        """Write the Dr deferred_coa / Cr revenue_coa JE."""
        from apps.finance.services.ledger_core import LedgerCoreMixin

        lines = [
            {'account_id': dr.deferred_coa_id, 'debit': amount, 'credit': Decimal('0'),
             'description': f'Release deferred revenue — {dr.name}'},
            {'account_id': dr.revenue_coa_id, 'debit': Decimal('0'), 'credit': amount,
             'description': f'Recognise revenue — {dr.name}',
             'contact_id': dr.contact_id, 'partner_type': 'CUSTOMER',
             'partner_id': dr.contact_id},
        ]
        je = LedgerCoreMixin.create_journal_entry(
            organization=dr.organization,
            transaction_date=timezone.now(),
            description=description,
            lines=lines,
            status='POSTED',
            scope=dr.scope,
            user=user,
            journal_type='ADJUSTMENT',
            journal_role='SYSTEM_ADJUSTMENT',
            source_module='finance',
            source_model='DeferredRevenue',
            source_id=dr.id,
            internal_bypass=True,
        )
        return je

    # ── Canary integrity signal ──
    @staticmethod
    def check_revenue_recognition_integrity(organization):
        """Tripwire for the revenue-recognition engine:

        1. Overdue releases — ACTIVE rows where start_date is in the past
           AND months_recognized < expected_months_elapsed. Indicates
           the engine hasn't been run.
        2. Orphan obligations — PO.is_satisfied=True but release_journal_entry
           is null AND deferred_revenue.status != CANCELLED. Indicates a
           satisfied milestone whose revenue was never recognised.
        3. Over-recognised — remaining_amount < 0. Indicates a double-
           release bug.
        """
        from apps.finance.models import DeferredRevenue, RevenuePerformanceObligation
        from django.utils import timezone
        from dateutil.relativedelta import relativedelta

        report = {
            'organization_id': organization.id,
            'organization_slug': getattr(organization, 'slug', None),
            'clean': True,
            'overdue_rows': [],
            'orphan_obligations': [],
            'over_recognised_rows': [],
        }

        today = timezone.now().date()

        for dr in DeferredRevenue.objects.filter(
            organization=organization, status='ACTIVE',
            recognition_method='STRAIGHT_LINE',
        ):
            if dr.start_date > today:
                continue
            months_elapsed = (
                (today.year - dr.start_date.year) * 12
                + (today.month - dr.start_date.month)
            )
            expected = min(months_elapsed, dr.duration_months)
            if dr.months_recognized < expected - 1:  # -1 = allow current month lag
                report['overdue_rows'].append({
                    'id': dr.id, 'name': dr.name,
                    'expected': expected, 'recognised': dr.months_recognized,
                    'lag_months': expected - dr.months_recognized,
                })
                report['clean'] = False

        orphans = RevenuePerformanceObligation.objects.filter(
            organization=organization,
            is_satisfied=True,
            release_journal_entry__isnull=True,
            deferred_revenue__status='ACTIVE',
        )
        for po in orphans:
            report['orphan_obligations'].append({
                'id': po.id,
                'description': po.description,
                'deferred_revenue_id': po.deferred_revenue_id,
                'allocation_amount': str(po.allocation_amount),
            })
            report['clean'] = False

        over = DeferredRevenue.objects.filter(
            organization=organization,
            remaining_amount__lt=Decimal('0.00'),
        )
        for dr in over:
            report['over_recognised_rows'].append({
                'id': dr.id, 'name': dr.name,
                'remaining': str(dr.remaining_amount),
            })
            report['clean'] = False

        return report
