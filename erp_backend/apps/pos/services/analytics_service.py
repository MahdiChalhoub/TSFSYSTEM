"""
SalesAnalyticsService — Gap 9 (ERP Roadmap)
============================================
Computes and persists SalesDailySummary rows from raw Order + OrderLine data.

Usage
-----
Called by the `aggregate_sales_daily` management command:
  python manage.py aggregate_sales_daily                  # yesterday
  python manage.py aggregate_sales_daily --date 2026-02-28
  python manage.py aggregate_sales_daily --date 2026-02-01 --days 28

All scopes and sites within an organization are aggregated in one call.
"""
from decimal import Decimal
from datetime import date, timedelta

from django.db import transaction
from django.db.models import (
    Sum, Count, Q, Case, When, Value, IntegerField as DjIntField
)


# Payment method → field mapping
_PAYMENT_METHOD_FIELDS = {
    'CASH':   'cash_total',
    'WAVE':   'mobile_total',
    'ORANGE_MONEY': 'mobile_total',
    'MTN_MOBILE': 'mobile_total',
    'CREDIT': 'credit_total',
    'BANK':   'bank_total',
}


class SalesAnalyticsService:
    """Stateless aggregation service. All methods are classmethods."""

    @classmethod
    def aggregate_day(cls, organization, target_date: date) -> list:
        """
        Rebuild SalesDailySummary rows for every (site, scope) combination
        that has orders on target_date for this organization.

        Returns a list of SalesDailySummary instances (newly created or updated).
        """
        from apps.pos.models import Order, SalesDailySummary

        # Find all (site, scope) pairs active on this date
        pairs = (
            Order.original_objects
            .filter(
                organization=organization,
                created_at__date=target_date,
                type='SALE',
            )
            .values('site_id', 'scope')
            .distinct()
        )

        results = []
        for pair in pairs:
            summary = cls._compute_summary(
                organization=organization,
                target_date=target_date,
                site_id=pair['site_id'],
                scope=pair['scope'] or 'OFFICIAL',
            )
            results.append(summary)

        return results

    @classmethod
    def _compute_summary(cls, organization, target_date: date, site_id, scope: str):
        """Compute and upsert a single (org, site, scope, date) summary row."""
        from django.db.models import F, ExpressionWrapper, DecimalField as DjDecimalField
        from apps.pos.models import Order, SalesDailySummary
        from apps.pos.models.pos_models import OrderLine

        qs = Order.original_objects.filter(
            organization=organization,
            created_at__date=target_date,
            type='SALE',
            site_id=site_id,
            scope=scope,
        )

        order_ids = list(qs.values_list('id', flat=True))

        # ── Order counts ───────────────────────────────────────────────────────
        counts = qs.aggregate(
            total=Count('id'),
            confirmed=Count('id', filter=Q(order_status='CONFIRMED')),
            delivered=Count('id', filter=Q(delivery_status='DELIVERED')),
            paid=Count('id', filter=Q(payment_status='PAID')),
            cancelled=Count('id', filter=Q(order_status='CANCELLED')),
            draft=Count('id', filter=Q(order_status='DRAFT')),
        )

        # ── Revenue ────────────────────────────────────────────────────────────
        rev = qs.aggregate(
            revenue_ht=Sum('subtotal_ht'),
            revenue_ttc=Sum('total_amount'),
            discount=Sum('discount_amount'),
        )
        revenue_ht  = rev['revenue_ht']  or Decimal('0')
        revenue_ttc = rev['revenue_ttc'] or Decimal('0')
        discount    = rev['discount']    or Decimal('0')
        tax_collected = revenue_ttc - revenue_ht

        # ── AIRSI (from OrderLineTaxEntry) ─────────────────────────────────────
        airsi_total = Decimal('0')
        try:
            from apps.pos.models.tax_entry_models import OrderLineTaxEntry
            airsi_total = (
                OrderLineTaxEntry.objects
                .filter(order_line__order__in=order_ids, tax_component='AIRSI')
                .aggregate(t=Sum('amount'))['t'] or Decimal('0')
            )
        except Exception:
            pass

        # ── COGS (effective_cost × quantity per line) ──────────────────────────
        cost_expr = ExpressionWrapper(
            F('effective_cost') * F('quantity'),
            output_field=DjDecimalField(max_digits=18, decimal_places=2)
        )
        cogs_agg = (
            OrderLine.original_objects
            .filter(order_id__in=order_ids, effective_cost__isnull=False)
            .aggregate(
                cogs=Sum(cost_expr),
                items=Sum('quantity'),
                unique_products=Count('product_id', distinct=True),
            )
        )
        cogs_total      = cogs_agg['cogs']            or Decimal('0')
        items_sold      = cogs_agg['items']           or Decimal('0')
        unique_products = cogs_agg['unique_products'] or 0

        gross_margin = revenue_ht - cogs_total
        margin_pct   = (
            round(gross_margin / revenue_ht * 100, 2)
            if revenue_ht else Decimal('0')
        )

        # ── Unique customers ───────────────────────────────────────────────────
        unique_customers = qs.exclude(contact_id=None).values('contact_id').distinct().count()

        # ── Payment method breakdown ───────────────────────────────────────────
        pm_map: dict[str, Decimal] = {}
        for row in qs.values('payment_method').annotate(t=Sum('total_amount')):
            pm_map[(row['payment_method'] or '').upper()] = row['t'] or Decimal('0')

        cash_total   = pm_map.get('CASH', Decimal('0'))
        credit_total = pm_map.get('CREDIT', Decimal('0'))
        bank_total   = pm_map.get('BANK', Decimal('0'))
        mobile_total = sum(
            pm_map.get(k, Decimal('0'))
            for k in ('WAVE', 'ORANGE_MONEY', 'MTN_MOBILE', 'MOBILE')
        )
        other_total = max(
            Decimal('0'),
            revenue_ttc - cash_total - mobile_total - credit_total - bank_total
        )

        # ── Upsert ─────────────────────────────────────────────────────────────
        with transaction.atomic():
            summary, _ = SalesDailySummary.original_objects.update_or_create(
                organization=organization,
                site_id=site_id,
                scope=scope,
                date=target_date,
                defaults=dict(
                    orders_total=counts['total'],
                    orders_confirmed=counts['confirmed'],
                    orders_delivered=counts['delivered'],
                    orders_paid=counts['paid'],
                    orders_cancelled=counts['cancelled'],
                    orders_draft=counts['draft'],
                    revenue_ht=revenue_ht,
                    revenue_ttc=revenue_ttc,
                    tax_collected=tax_collected,
                    airsi_withheld=airsi_total,
                    discount_total=discount,
                    cogs_total=cogs_total,
                    gross_margin=gross_margin,
                    gross_margin_pct=margin_pct,
                    cash_total=cash_total,
                    mobile_total=mobile_total,
                    credit_total=credit_total,
                    bank_total=bank_total,
                    other_total=other_total,
                    items_sold=items_sold,
                    unique_products=unique_products,
                    unique_customers=unique_customers,
                    order_ids=order_ids,
                )
            )
        return summary

