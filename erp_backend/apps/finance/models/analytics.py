"""
FinanceDailySummary — Precomputed Tax Analytics
================================================
Pre-aggregated daily tax totals from OrderLineTaxEntry.
Rebuilt nightly by Celery Beat at 02:30.
Allows VAT Return Report to query this table instead of
scanning raw OrderLineTaxEntry on every request.
"""
from django.db import models
from django.utils import timezone
from erp.models import Organization


class FinanceDailySummary(models.Model):
    """One row per (organization, date, scope)."""

    organization     = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='finance_daily_summaries',
    db_column='tenant_id',
    )
    date             = models.DateField()
    scope            = models.CharField(max_length=10, default='OFFICIAL')  # OFFICIAL | INTERNAL

    # ── VAT ──────────────────────────────────────────────────────
    vat_collected    = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    vat_recoverable  = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    net_vat_due      = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    # positive = payable to tax authority, negative = refund owed to org

    # ── AIRSI ────────────────────────────────────────────────────
    airsi_withheld   = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    # withheld by org from supplier invoices

    # ── Custom / Misc Taxes ──────────────────────────────────────
    custom_tax_total = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    reverse_charge_total = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    purchase_tax_total   = models.DecimalField(max_digits=18, decimal_places=4, default=0)

    # ── Metadata ─────────────────────────────────────────────────
    rebuilt_at       = models.DateTimeField(auto_now=True)
    order_line_count = models.IntegerField(default=0)  # how many tax entries aggregated

    class Meta:
        app_label = 'finance'
        unique_together = ('organization', 'date', 'scope')
        indexes = [
            models.Index(fields=['organization', 'date', 'scope'],
                         name='fin_daily_org_date_scope_idx'),
        ]
        ordering = ['-date']

    def __str__(self):
        return f"FinanceDailySummary org={self.organization_id} {self.date} {self.scope}"
