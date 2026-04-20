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
