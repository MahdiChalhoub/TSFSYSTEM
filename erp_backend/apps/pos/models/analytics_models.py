"""
Sales Analytics Models — Gap 9
================================
Pre-aggregated daily summary table for fast analytics queries.

Design: populated by the `aggregate_sales_daily` management command
(or a nightly cron/Celery task). Never query raw Order + OrderLine tables
for dashboard KPIs — use SalesDailySummary instead.

Table: sales_daily_summary
Partition key: (organization, site, scope, date)
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class SalesDailySummary(TenantModel):
    """
    Pre-aggregated daily sales metrics per site and scope.

    One row per (organization, site, scope, date).
    Rebuilt idempotently each night — existing rows are replaced, not appended.
    """

    # ── Partition key ──────────────────────────────────────────────────────────
    date  = models.DateField(db_index=True)
    site  = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='daily_summaries',
        help_text='The site/warehouse this summary covers. NULL = cross-site aggregate.'
    )
    scope = models.CharField(
        max_length=20, default='OFFICIAL',
        help_text='OFFICIAL or INTERNAL — matches Order.scope'
    )

    # ── Order counts ───────────────────────────────────────────────────────────
    orders_total      = models.IntegerField(default=0)
    orders_confirmed  = models.IntegerField(default=0)
    orders_delivered  = models.IntegerField(default=0)
    orders_paid       = models.IntegerField(default=0)
    orders_cancelled  = models.IntegerField(default=0)
    orders_draft      = models.IntegerField(default=0)

    # ── Revenue ────────────────────────────────────────────────────────────────
    revenue_ht        = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    revenue_ttc       = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    tax_collected     = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'),
        help_text='VAT / TVA collected (revenue_ttc - revenue_ht)')
    airsi_withheld    = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'),
        help_text='AÏRSI tax withheld total')
    discount_total    = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'),
        help_text='Total discount amount granted')

    # ── COGS & Margin ──────────────────────────────────────────────────────────
    cogs_total        = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'),
        help_text='Sum of effective_cost × qty across all paid/delivered order lines')
    gross_margin      = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'),
        help_text='revenue_ht − cogs_total')
    gross_margin_pct  = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'),
        help_text='gross_margin / revenue_ht × 100')

    # ── Payment method breakdown ───────────────────────────────────────────────
    cash_total        = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    mobile_total      = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'),
        help_text='Wave, Orange Money, etc.')
    credit_total      = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'),
        help_text='A/R credit sales (not yet collected)')
    bank_total        = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    other_total       = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))

    # ── Line counts ────────────────────────────────────────────────────────────
    items_sold        = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'),
        help_text='Total quantity of items sold (sum of OrderLine.quantity)')
    unique_products   = models.IntegerField(default=0,
        help_text='Distinct product count for this day/site')
    unique_customers  = models.IntegerField(default=0,
        help_text='Distinct customer (contact) count')

    # ── Metadata ───────────────────────────────────────────────────────────────
    computed_at  = models.DateTimeField(auto_now=True,
        help_text='Last time this row was (re)computed')
    order_ids    = models.JSONField(default=list, blank=True,
        help_text='List of Order PKs used in this summary (for debugging)')

    class Meta:
        db_table         = 'sales_daily_summary'
        unique_together  = ('organization', 'site', 'scope', 'date')
        ordering         = ['-date', 'scope']
        indexes          = [
            models.Index(fields=['organization', 'date', 'scope'],    name='sds_org_date_scope_idx'),
            models.Index(fields=['organization', 'site', 'date'],     name='sds_org_site_date_idx'),
        ]

    def __str__(self):
        site_label = self.site.name if self.site else 'ALL'
        return f"[{self.date}] {site_label} ({self.scope}) — TTC {self.revenue_ttc}"

    @property
    def avg_order_value(self):
        if self.orders_total:
            return self.revenue_ttc / self.orders_total
        return Decimal('0')
