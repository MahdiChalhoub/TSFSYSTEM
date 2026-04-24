"""
Finance Background Tasks
========================
Celery tasks for precomputed analytics and scheduled finance operations.
"""
import logging
from decimal import Decimal
from celery import shared_task
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)


@shared_task(name='finance.tasks.rebuild_finance_daily_summary')
def rebuild_finance_daily_summary(org_id: int = None, date_str: str = None):
    """
    Aggregate OrderLineTaxEntry into FinanceDailySummary rows.
    Idempotent — each call does an upsert on (org, date, scope).

    Args:
        org_id:   If None, rebuilds for ALL organizations.
        date_str: ISO date string 'YYYY-MM-DD'. If None, uses yesterday.
    """
    from datetime import date, timedelta
    from django.db.models import Sum, Count, Q

    from erp.connector_registry import connector
    OrderLineTaxEntry = connector.require('pos.order_lines.get_tax_entry_model', org_id=0, source='finance')
    if not OrderLineTaxEntry:
        return None
    from erp.models import Organization
    from apps.finance.models import FinanceDailySummary

    # Resolve target date
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            logger.error(f"[rebuild_finance_daily_summary] bad date_str: {date_str}")
            return {'error': f'Invalid date: {date_str}'}
    else:
        target_date = (timezone.now() - timedelta(days=1)).date()

    # Resolve target orgs
    if org_id:
        orgs = Organization.objects.filter(id=org_id)
    else:
        orgs = Organization.objects.all()

    total_rows = 0

    for org in orgs:
        for scope in ('OFFICIAL', 'INTERNAL'):
            entries = OrderLineTaxEntry.objects.filter(
                order_line__order__tenant=org,
                order_line__order__scope=scope,
                order_line__order__created_at__date=target_date,
            )

            if not entries.exists():
                continue

            agg = entries.aggregate(
                vat_collected=Sum('tax_amount', filter=Q(
                    tax_type='VAT',
                    order_line__order__order_type__in=['SALE', 'RETURN']
                )),
                vat_recoverable=Sum('tax_amount', filter=Q(
                    tax_type='VAT',
                    order_line__order__order_type__in=['PURCHASE']
                )),
                airsi_withheld=Sum('tax_amount', filter=Q(tax_type='AIRSI')),
                custom_tax=Sum('tax_amount', filter=Q(tax_type='CUSTOM')),
                reverse_charge=Sum('tax_amount', filter=Q(tax_type='REVERSE_CHARGE')),
                purchase_tax=Sum('tax_amount', filter=Q(tax_type='PURCHASE_TAX')),
                entry_count=Count('id'),
            )

            def d(val): return val or Decimal('0')

            vat_collected   = d(agg['vat_collected'])
            vat_recoverable = d(agg['vat_recoverable'])

            with transaction.atomic():
                obj, _ = FinanceDailySummary.objects.update_or_create(
                    organization=org,
                    date=target_date,
                    scope=scope,
                    defaults={
                        'vat_collected':      vat_collected,
                        'vat_recoverable':    vat_recoverable,
                        'net_vat_due':        vat_collected - vat_recoverable,
                        'airsi_withheld':     d(agg['airsi_withheld']),
                        'custom_tax_total':   d(agg['custom_tax']),
                        'reverse_charge_total': d(agg['reverse_charge']),
                        'purchase_tax_total': d(agg['purchase_tax']),
                        'order_line_count':   agg['entry_count'] or 0,
                    }
                )
            total_rows += 1
            logger.info(
                f"[rebuild_finance_daily_summary] org={org.id} date={target_date} "
                f"scope={scope} vat_due={vat_collected - vat_recoverable}"
            )

    logger.info(f"[rebuild_finance_daily_summary] Done — {total_rows} rows upserted")
    return {'upserted_rows': total_rows, 'date': str(target_date)}


@shared_task(name='finance.tasks.backfill_finance_summary')
def backfill_finance_summary(org_id: int = None, days: int = 30):
    """
    Backfill the last N days of FinanceDailySummary.
    Used for initial data population after model creation.
    """
    from datetime import date, timedelta
    today = timezone.now().date()
    results = []
    for i in range(1, days + 1):
        d = today - timedelta(days=i)
        result = rebuild_finance_daily_summary(org_id=org_id, date_str=str(d))
        results.append(result)
    logger.info(f"[backfill_finance_summary] Backfilled {days} days")
    return {'days_processed': days, 'results': results}


@shared_task(name='apps.finance.tasks.fire_period_reminders')
def fire_period_reminders():
    """Daily Celery Beat job: fire PERIOD_CLOSING_SOON / PERIOD_STARTING_SOON
    auto-task events for every org, using each org's configured lead-time
    (Organization.settings['period_reminder_days_before'], default 7)."""
    from django.core.management import call_command
    call_command('fire_period_reminders')
    logger.info('[fire_period_reminders] Completed daily fiscal-period reminder sweep')
    return {'status': 'ok'}


@shared_task(name='apps.finance.tasks.run_close_chain_canary')
def run_close_chain_canary(org_id: int | None = None):
    """Daily drift-monitor for the fiscal-year close chain.

    Walks every organization (or just `org_id` if given) and runs the
    OB↔JE validator + JE-coverage gate across every fiscal year. Any
    per-year drift or coverage mismatch is:
      - logged at WARNING level (so it shows up in log aggregation)
      - returned in the task result for programmatic pickup

    Safe to run daily — read-only. Takes ~1s per org on typical data.
    Designed to be the first alarm if a deployment introduces silent
    corruption: if this starts failing, STOP before closing another
    year until the root cause is understood.

    Result shape:
      {
        'ran_at': iso-datetime,
        'orgs_total': int,
        'orgs_clean': int,
        'orgs_drifted': int,
        'details': [
          {'org_id': int, 'org_slug': str, 'safe': bool,
           'years_drift': int, 'years_missing_je': int,
           'first_broken_year': str | None},
          ...
        ]
      }
    """
    from apps.finance.services.closing_service import ClosingService
    from erp.models import Organization

    orgs = (
        Organization.objects.filter(id=org_id)
        if org_id is not None
        else Organization.objects.all()
    )

    out = {
        'ran_at': timezone.now().isoformat(),
        'orgs_total': 0,
        'orgs_clean': 0,
        'orgs_drifted': 0,
        'details': [],
    }

    for org in orgs:
        out['orgs_total'] += 1
        try:
            rpt = ClosingService.is_safe_to_flip_flag(org)
        except Exception as exc:
            logger.exception(
                "Canary: is_safe_to_flip_flag crashed for org %s: %s",
                org.id, exc,
            )
            out['orgs_drifted'] += 1
            out['details'].append({
                'org_id': org.id,
                'org_slug': getattr(org, 'slug', None),
                'safe': False,
                'error': str(exc),
            })
            continue

        first_broken = next(
            (y['fy_name'] for y in rpt['years'] if y['has_drift']),
            None,
        )
        detail = {
            'org_id': org.id,
            'org_slug': rpt.get('organization_slug'),
            'safe': rpt['safe'],
            'years_drift': rpt['years_drift'],
            'years_missing_je': rpt['years_missing_je'],
            'first_broken_year': first_broken,
        }
        out['details'].append(detail)

        # Parent-purity tripwire — SUM(balance) per parent must be 0.
        # Run unconditionally so we surface violations even on orgs whose
        # OB↔JE chain is otherwise clean. A non-zero parent means a JE
        # slipped past the posting guard (manual DB write, pre-guard
        # historical lines, future regression) and the close gate would
        # later refuse to finalize — better to know now.
        try:
            purity = ClosingService.check_parent_purity(org)
        except Exception as exc:
            logger.exception(
                "Canary: check_parent_purity crashed for org %s: %s",
                org.id, exc,
            )
            purity = {'clean': False, 'offenders': [], 'error': str(exc)}

        detail['parent_purity_clean'] = purity['clean']
        detail['parent_offender_count'] = len(purity.get('offenders', []))
        if not purity['clean']:
            # Top 3 in the detail row so the task result stays compact;
            # full list still lands in the warning log below.
            detail['parent_offenders_top'] = [
                {k: str(v) for k, v in off.items()}
                for off in purity.get('offenders', [])[:3]
            ]

        # Sub-ledger integrity — control accounts must have partner data
        # on every line. Missing or orphan partner links break aging,
        # statements, and collection reports.
        try:
            subledger = ClosingService.check_subledger_integrity(org)
        except Exception as exc:
            logger.exception(
                "Canary: check_subledger_integrity crashed for org %s: %s",
                org.id, exc,
            )
            subledger = {'clean': False, 'offenders': [], 'error': str(exc)}

        detail['subledger_clean'] = subledger['clean']
        detail['subledger_offender_count'] = len(subledger.get('offenders', []))
        if not subledger['clean']:
            detail['subledger_offenders_top'] = [
                {k: str(v) for k, v in off.items() if k != 'partner_ids'}
                for off in subledger.get('offenders', [])[:3]
            ]

        # Snapshot hash-chain — tamper detection over
        # FiscalYearCloseSnapshot rows. Any direct DB write bypassing
        # save() invalidates the stored hash and is picked up here. If
        # this ever trips, treat it as a possible breach: a later
        # snapshot cannot compensate for a tampered earlier one because
        # the chain walk uses stored (not recomputed) hashes.
        try:
            snap = ClosingService.verify_snapshot_chain(org)
        except Exception as exc:
            logger.exception(
                "Canary: verify_snapshot_chain crashed for org %s: %s",
                org.id, exc,
            )
            snap = {'clean': False, 'breaks': [], 'error': str(exc)}

        detail['snapshot_chain_clean'] = snap['clean']
        detail['snapshot_chain_rows'] = snap.get('rows_checked', 0)
        detail['snapshot_chain_breaks'] = len(snap.get('breaks', []))
        if not snap['clean']:
            detail['snapshot_chain_breaks_top'] = [
                {k: str(v) for k, v in br.items()}
                for br in snap.get('breaks', [])[:3]
            ]

        # Consolidation integrity — failed runs, groups missing IC rules,
        # recent closed periods without a COMPLETED consolidation.
        # Skipped silently for orgs with no ConsolidationGroup rows.
        try:
            from apps.finance.services.consolidation_service import (
                ConsolidationService,
            )
            cons_rpt = ConsolidationService.check_consolidation_integrity(org)
        except Exception as exc:
            logger.exception(
                "Canary: check_consolidation_integrity crashed for org %s: %s",
                org.id, exc,
            )
            cons_rpt = {'clean': True, 'error': str(exc)}  # fail-open on missing models
        detail['consolidation_clean'] = cons_rpt.get('clean', True)
        detail['consolidation_failed_runs'] = len(cons_rpt.get('failed_runs', []))
        detail['consolidation_missing_ic'] = len(cons_rpt.get('groups_missing_ic_rules', []))
        detail['consolidation_missing_runs'] = len(cons_rpt.get('periods_missing_consolidation', []))

        # Revenue-recognition integrity — overdue releases, orphan
        # satisfied obligations, over-recognised rows.
        try:
            from apps.finance.services.revenue_recognition_service import (
                RevenueRecognitionService,
            )
            rev_rpt = RevenueRecognitionService.check_revenue_recognition_integrity(org)
        except Exception as exc:
            logger.exception(
                "Canary: check_revenue_recognition_integrity crashed for org %s: %s",
                org.id, exc,
            )
            rev_rpt = {'clean': False, 'error': str(exc)}
        detail['revenue_recognition_clean'] = rev_rpt.get('clean', False)
        detail['revenue_overdue_rows'] = len(rev_rpt.get('overdue_rows', []))
        detail['revenue_orphan_obligations'] = len(rev_rpt.get('orphan_obligations', []))
        detail['revenue_over_recognised'] = len(rev_rpt.get('over_recognised_rows', []))

        # FX integrity — stale-rate, missing-revaluation, orphaned
        # revaluation detection. Skipped silently if no base currency
        # is configured (org doesn't use multi-currency yet).
        try:
            fx_rpt = ClosingService.check_fx_integrity(org)
        except Exception as exc:
            logger.exception(
                "Canary: check_fx_integrity crashed for org %s: %s",
                org.id, exc,
            )
            fx_rpt = {'clean': False, 'stale_rate_lines': 0, 'error': str(exc)}

        detail['fx_integrity_clean'] = fx_rpt['clean']
        detail['fx_stale_rate_lines'] = fx_rpt.get('stale_rate_lines', 0)
        detail['fx_missing_revaluations'] = len(fx_rpt.get('missing_revaluation_periods', []))
        detail['fx_orphaned_revaluations'] = len(fx_rpt.get('orphaned_revaluations', []))

        # Denormalized-balance validator — confirms COA.balance /
        # COA.balance_official match a fresh JE-line aggregation. Drift
        # is the fingerprint of a race, a manual DB edit, or a bug in
        # the posting pipeline. Auto-fix is NOT triggered here — operator
        # must run `recalc_balances` after investigating why it drifted.
        try:
            bal_rpt = ClosingService.validate_balance_integrity(org)
        except Exception as exc:
            logger.exception(
                "Canary: validate_balance_integrity crashed for org %s: %s",
                org.id, exc,
            )
            bal_rpt = {'clean': False, 'drifts': [], 'error': str(exc)}

        detail['balance_integrity_clean'] = bal_rpt['clean']
        detail['balance_integrity_drifted_accounts'] = bal_rpt.get('drifted', 0)
        detail['balance_integrity_rows'] = len(bal_rpt.get('drifts', []))
        if not bal_rpt['clean']:
            detail['balance_integrity_drifts_top'] = [
                {k: str(v) for k, v in dr.items()}
                for dr in bal_rpt.get('drifts', [])[:3]
            ]

        overall_safe = (
            rpt['safe']
            and purity['clean']
            and subledger['clean']
            and snap['clean']
            and bal_rpt['clean']
            and fx_rpt['clean']
            and rev_rpt.get('clean', False)
            and cons_rpt.get('clean', True)
        )
        if overall_safe:
            out['orgs_clean'] += 1
        else:
            out['orgs_drifted'] += 1
            logger.warning(
                "Canary ALERT org=%s slug=%s: years_drift=%s years_missing_je=%s "
                "first_broken=%s parent_offenders=%s subledger_offenders=%s "
                "snapshot_breaks=%s — investigate before next year close.",
                org.id, detail['org_slug'], rpt['years_drift'],
                rpt['years_missing_je'], first_broken,
                detail['parent_offender_count'],
                detail['subledger_offender_count'],
                detail['snapshot_chain_breaks'],
            )
            if purity.get('offenders'):
                for off in purity['offenders']:
                    logger.warning(
                        "Canary PARENT-DIRTY org=%s %s %s [%s]: net=%s "
                        "across %s line(s)",
                        org.id, off['code'], off['name'], off['scope'],
                        off['net'], off['n_lines'],
                    )

    logger.info(
        "Canary: %s/%s orgs clean, %s drifted",
        out['orgs_clean'], out['orgs_total'], out['orgs_drifted'],
    )

    # ── Alerting ──
    # If any org drifted, fire the alerting hooks. Non-blocking: a
    # webhook/email failure must never take down the canary itself.
    if out['orgs_drifted'] > 0:
        try:
            _dispatch_canary_alerts(out)
        except Exception as exc:
            logger.exception("Canary alert dispatch failed: %s", exc)

    return out


def _dispatch_canary_alerts(report):
    """Fire any configured alert channels when the canary detects drift.

    Channels are discovered from Django settings:
      FINANCE_CANARY_ALERT_WEBHOOKS: list of URLs (optional). POSTed
        with the full report JSON.
      FINANCE_CANARY_ALERT_EMAILS: list of email addresses (optional).
        Sent a text summary.

    If neither is configured, this function is a no-op. This keeps the
    canary usable in dev without ceremony, while letting production
    deployments opt in per tenant.
    """
    import json
    from django.conf import settings

    webhooks = getattr(settings, 'FINANCE_CANARY_ALERT_WEBHOOKS', []) or []
    emails = getattr(settings, 'FINANCE_CANARY_ALERT_EMAILS', []) or []

    if not webhooks and not emails:
        return

    dirty = [d for d in report.get('details', []) if not d.get('safe', True)
             or not d.get('parent_purity_clean', True)
             or not d.get('subledger_clean', True)
             or not d.get('snapshot_chain_clean', True)
             or not d.get('balance_integrity_clean', True)
             or not d.get('fx_integrity_clean', True)
             or not d.get('revenue_recognition_clean', True)
             or not d.get('consolidation_clean', True)]
    if not dirty:
        return

    subject = (
        f"[Finance Canary] {len(dirty)} organization(s) reporting drift "
        f"at {report['ran_at']}"
    )
    # Plain-text summary — one line per dirty org with its trouble spots
    summary_lines = [subject, '']
    for d in dirty:
        problems = []
        if not d.get('safe', True):
            problems.append(f"OB↔JE: {d.get('years_drift', 0)} yrs drift")
        if not d.get('parent_purity_clean', True):
            problems.append(f"parent: {d.get('parent_offender_count', 0)}")
        if not d.get('subledger_clean', True):
            problems.append(f"subledger: {d.get('subledger_offender_count', 0)}")
        if not d.get('snapshot_chain_clean', True):
            problems.append(f"snapshot: {d.get('snapshot_chain_breaks', 0)} breaks")
        if not d.get('balance_integrity_clean', True):
            problems.append(f"balance drift: {d.get('balance_integrity_drifted_accounts', 0)}")
        if not d.get('fx_integrity_clean', True):
            problems.append(f"FX: {d.get('fx_stale_rate_lines', 0)} stale")
        if not d.get('revenue_recognition_clean', True):
            problems.append(f"rev-rec: {d.get('revenue_overdue_rows', 0)} overdue")
        if not d.get('consolidation_clean', True):
            problems.append(f"consolidation: {d.get('consolidation_missing_runs', 0)} missing")
        summary_lines.append(f"- {d.get('org_slug')}: {'; '.join(problems)}")

    summary = '\n'.join(summary_lines)

    # Webhook dispatch — uses stdlib urllib to avoid a hard httpx/requests
    # dependency. 5s timeout so one bad endpoint can't stall the others.
    if webhooks:
        import urllib.request
        payload = json.dumps(report, default=str).encode('utf-8')
        for url in webhooks:
            try:
                req = urllib.request.Request(
                    url, data=payload,
                    headers={'Content-Type': 'application/json'},
                )
                urllib.request.urlopen(req, timeout=5)
                logger.info("Canary: alert webhook fired → %s", url)
            except Exception as exc:
                logger.warning("Canary: webhook %s failed: %s", url, exc)

    if emails:
        try:
            from django.core.mail import send_mail
            send_mail(
                subject=subject, message=summary,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
                recipient_list=list(emails), fail_silently=True,
            )
            logger.info("Canary: alert email sent to %s recipient(s)", len(emails))
        except Exception as exc:
            logger.warning("Canary: email dispatch failed: %s", exc)
