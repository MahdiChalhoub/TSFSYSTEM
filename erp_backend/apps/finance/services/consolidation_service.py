"""
Consolidation Service — execute a ConsolidationRun per group + fiscal
period.

Stages:
  1. Aggregate each subsidiary's trial balance for the period into
     ConsolidationLine(line_type=ENTITY).
  2. Translate foreign-currency entities into group reporting currency
     using the period-end exchange rate → ConsolidationLine(FX_TRANSLATION).
  3. Apply intercompany elimination rules → ConsolidationLine(ELIMINATION).
  4. Mark ConsolidationRun as COMPLETED, update counters.

Design notes:
  • Stays out of the ledger — consolidation lines are reporting-only
    aggregates, not postings. This keeps each subsidiary's books untouched
    and lets the run be deleted/recomputed without lifecycle drama.
  • Elimination amounts use the MINIMUM of the two offsetting balances
    (standard accounting practice for IC matching).
  • Integrity signal surfaces stale/incomplete runs for canary pickup.

Not in scope of this MVP (intentionally): goodwill, noncontrolling
interest (NCI), multi-level subsidiary rollups, hedge accounting on
translation. These are real features of NetSuite/SAP/Oracle; adding
them requires more model surface and per-customer configuration.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class ConsolidationService:
    """Execute a consolidation run for a ConsolidationGroup."""

    @staticmethod
    def run_consolidation(group, fiscal_period, user=None):
        """Produce a ConsolidationRun with entity / FX / elimination lines.

        Args:
            group: ConsolidationGroup
            fiscal_period: FiscalPeriod to consolidate
            user: optional, stamped on the run

        Returns: ConsolidationRun row (status COMPLETED on success,
        FAILED on exception — the exception re-raises).
        """
        from apps.finance.models import (
            ConsolidationRun, ConsolidationLine, ConsolidationEntity,
            IntercompanyRule, JournalEntryLine, ExchangeRate, Currency,
        )
        from django.db.models import Sum

        run = ConsolidationRun.objects.create(
            organization=group.organization,
            group=group,
            fiscal_period=fiscal_period,
            status='PROCESSING',
            created_by=user,
        )

        try:
            with transaction.atomic():
                # ── Stage 1: Entity balances ──
                entities_processed = 0
                for entity in group.entities.filter(
                    is_active=True,
                ).exclude(method='EXCLUDED'):
                    ConsolidationService._emit_entity_lines(
                        run, entity, fiscal_period,
                    )
                    entities_processed += 1

                # ── Stage 2: FX translation for foreign-currency entities ──
                fx_applied = 0
                for entity in group.entities.filter(
                    is_active=True,
                ).exclude(method='EXCLUDED'):
                    if (
                        entity.functional_currency
                        and entity.functional_currency != group.base_currency
                    ):
                        fx_applied += ConsolidationService._emit_fx_translation(
                            run, entity, fiscal_period,
                        )

                # ── Stage 3: Intercompany eliminations ──
                elim_applied = 0
                for rule in group.intercompany_rules.filter(is_active=True):
                    if ConsolidationService._emit_elimination(
                        run, rule, fiscal_period,
                    ):
                        elim_applied += 1

                run.entities_processed = entities_processed
                run.eliminations_applied = elim_applied
                run.fx_adjustments_applied = fx_applied
                run.status = 'COMPLETED'
                run.completed_at = timezone.now()
                run.save()

            logger.info(
                "ConsolidationService: run=%s completed entities=%s fx=%s elim=%s",
                run.id, entities_processed, fx_applied, elim_applied,
            )
            return run
        except Exception as exc:
            run.status = 'FAILED'
            run.save()
            logger.exception("Consolidation run %s failed: %s", run.id, exc)
            raise

    @staticmethod
    def _emit_entity_lines(run, entity, fiscal_period):
        """Aggregate POSTED JE lines for this subsidiary × period and
        write one ConsolidationLine per account."""
        from apps.finance.models import JournalEntryLine, ConsolidationLine
        from django.db.models import Sum

        rows = (
            JournalEntryLine.objects.filter(
                organization=entity.entity_organization,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__fiscal_period=fiscal_period,
            )
            .values('account_id')
            .annotate(d=Sum('debit'), c=Sum('credit'))
        )

        # Apply ownership % for proportional / equity methods
        pct = (entity.ownership_percentage or Decimal('100.00')) / Decimal('100.00')
        method = entity.method
        mult = pct if method in ('PROPORTIONAL', 'EQUITY') else Decimal('1.00')

        for r in rows:
            d = (r['d'] or Decimal('0.00')) * mult
            c = (r['c'] or Decimal('0.00')) * mult
            if d == Decimal('0.00') and c == Decimal('0.00'):
                continue
            ConsolidationLine.objects.create(
                organization=run.organization,
                run=run, entity=entity,
                account_id=r['account_id'],
                line_type='ENTITY',
                debit=d, credit=c,
                debit_base=d, credit_base=c,  # filled properly in FX stage
                description=f"Entity balance ({entity.entity_organization})",
            )

    @staticmethod
    def _emit_fx_translation(run, entity, fiscal_period):
        """For a foreign-currency entity, compute and emit FX_TRANSLATION
        adjustments that convert each account's entity-line balance from
        functional → group-reporting currency using the period-end rate.
        Returns the number of translation lines written.
        """
        from apps.finance.models import ConsolidationLine, ExchangeRate

        # Period-end rate: functional_currency → group.base_currency
        rate_row = ExchangeRate.objects.filter(
            organization=run.organization,
            from_currency=entity.functional_currency,
            to_currency=run.group.base_currency,
            effective_date__lte=fiscal_period.end_date,
        ).order_by('-effective_date').first()
        if not rate_row:
            logger.warning(
                "FX translation: no rate for %s→%s as of %s, skipping",
                entity.functional_currency, run.group.base_currency,
                fiscal_period.end_date,
            )
            return 0

        rate = rate_row.rate
        n = 0
        # Pull the ENTITY lines we wrote in stage 1 and rewrite their
        # _base columns + emit a summary FX_TRANSLATION delta line per
        # account for transparency.
        entity_lines = ConsolidationLine.objects.filter(
            run=run, entity=entity, line_type='ENTITY',
        )
        for line in entity_lines:
            new_d = (line.debit * rate).quantize(Decimal('0.01'))
            new_c = (line.credit * rate).quantize(Decimal('0.01'))
            delta_d = new_d - line.debit_base
            delta_c = new_c - line.credit_base
            line.debit_base = new_d
            line.credit_base = new_c
            line.exchange_rate = rate
            line.save(update_fields=['debit_base', 'credit_base', 'exchange_rate'])

            if delta_d != Decimal('0.00') or delta_c != Decimal('0.00'):
                ConsolidationLine.objects.create(
                    organization=run.organization,
                    run=run, entity=entity,
                    account_id=line.account_id,
                    line_type='FX_TRANSLATION',
                    debit=Decimal('0.00'), credit=Decimal('0.00'),
                    debit_base=delta_d, credit_base=delta_c,
                    exchange_rate=rate,
                    description=(
                        f"FX translation {entity.functional_currency}→"
                        f"{run.group.base_currency} @ {rate}"
                    ),
                )
                n += 1
        return n

    @staticmethod
    def _emit_elimination(run, rule, fiscal_period):
        """Find the offsetting IC balances and emit an ELIMINATION line
        that zeros the minimum of the two sides. Returns True if an
        elimination was written, False if nothing to eliminate.
        """
        from apps.finance.models import ConsolidationLine
        from django.db.models import Sum

        a_agg = ConsolidationLine.objects.filter(
            run=run, entity=rule.entity_a, account=rule.account_a,
            line_type='ENTITY',
        ).aggregate(d=Sum('debit_base'), c=Sum('credit_base'))
        b_agg = ConsolidationLine.objects.filter(
            run=run, entity=rule.entity_b, account=rule.account_b,
            line_type='ENTITY',
        ).aggregate(d=Sum('debit_base'), c=Sum('credit_base'))

        a_net = (a_agg['d'] or Decimal('0.00')) - (a_agg['c'] or Decimal('0.00'))
        b_net = (b_agg['d'] or Decimal('0.00')) - (b_agg['c'] or Decimal('0.00'))

        # Classic IC elimination: the two accounts should be equal and
        # opposite (AR on side A == AP on side B). We eliminate the
        # minimum absolute amount on both sides.
        elim_amount = min(abs(a_net), abs(b_net))
        if elim_amount == Decimal('0.00'):
            return False

        # On side A: reverse the direction of A's net
        if a_net > 0:
            a_d, a_c = Decimal('0.00'), elim_amount  # credit to cancel debit
        else:
            a_d, a_c = elim_amount, Decimal('0.00')
        if b_net > 0:
            b_d, b_c = Decimal('0.00'), elim_amount
        else:
            b_d, b_c = elim_amount, Decimal('0.00')

        ConsolidationLine.objects.create(
            organization=run.organization,
            run=run, entity=rule.entity_a, account=rule.account_a,
            line_type='ELIMINATION',
            debit=a_d, credit=a_c,
            debit_base=a_d, credit_base=a_c,
            description=f"IC elimination ({rule.elimination_type}) vs {rule.entity_b}",
        )
        ConsolidationLine.objects.create(
            organization=run.organization,
            run=run, entity=rule.entity_b, account=rule.account_b,
            line_type='ELIMINATION',
            debit=b_d, credit=b_c,
            debit_base=b_d, credit_base=b_c,
            description=f"IC elimination ({rule.elimination_type}) vs {rule.entity_a}",
        )
        return True

    # ── Canary integrity signal ──
    @staticmethod
    def check_consolidation_integrity(organization):
        """Tripwire for consolidation state:

        1. Any FAILED ConsolidationRun in the last 90 days.
        2. Any ACTIVE ConsolidationGroup with entities but zero
           IntercompanyRule rows — almost always a config gap (IC
           transactions exist but elimination rules missing).
        3. Any closed FiscalPeriod that has group-scoped activity but
           no COMPLETED ConsolidationRun for any group — the
           consolidation was never refreshed for that period.

        Skipped silently for orgs with zero groups (consolidation
        inapplicable).
        """
        from apps.finance.models import (
            ConsolidationGroup, ConsolidationRun, IntercompanyRule,
            FiscalPeriod,
        )
        from datetime import timedelta

        report = {
            'organization_id': organization.id,
            'organization_slug': getattr(organization, 'slug', None),
            'clean': True,
            'failed_runs': [],
            'groups_missing_ic_rules': [],
            'periods_missing_consolidation': [],
        }

        groups = ConsolidationGroup.objects.filter(
            organization=organization, is_active=True,
        )
        if not groups.exists():
            return report  # No groups configured → nothing to check

        cutoff = timezone.now() - timedelta(days=90)

        # 1. Failed runs
        for run in ConsolidationRun.objects.filter(
            organization=organization, status='FAILED',
            created_at__gte=cutoff,
        ).select_related('group', 'fiscal_period'):
            report['failed_runs'].append({
                'run_id': run.id, 'group': run.group.name,
                'period': run.fiscal_period.name,
                'created_at': run.created_at.isoformat(),
            })
            report['clean'] = False

        # 2. Groups with entities but no IC rules
        for g in groups.prefetch_related('entities', 'intercompany_rules'):
            n_entities = g.entities.filter(is_active=True).count()
            n_rules = g.intercompany_rules.filter(is_active=True).count()
            if n_entities >= 2 and n_rules == 0:
                report['groups_missing_ic_rules'].append({
                    'group_id': g.id, 'group_name': g.name,
                    'entities': n_entities,
                })
                report['clean'] = False

        # 3. Closed periods without a COMPLETED run
        # (Only check recent closed periods; noise for very old history.)
        six_months_ago = (timezone.now() - timedelta(days=180)).date()
        recent_closed = FiscalPeriod.objects.filter(
            organization=organization,
            is_closed=True,
            end_date__gte=six_months_ago,
        )
        for fp in recent_closed:
            for g in groups:
                has_run = ConsolidationRun.objects.filter(
                    organization=organization,
                    group=g, fiscal_period=fp, status='COMPLETED',
                ).exists()
                if not has_run:
                    report['periods_missing_consolidation'].append({
                        'period': fp.name, 'period_id': fp.id,
                        'group': g.name, 'group_id': g.id,
                    })
                    report['clean'] = False

        return report
