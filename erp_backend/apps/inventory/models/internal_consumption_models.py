"""
Internal Consumption Event Models
==================================
Business events for internal use of inventory (auto-livraison).

These are inventory events first (goods consumed internally),
with VAT implications calculated by the tax engine.

Previously in: finance/models/tax_engine_ext.py (SelfSupplyVATEvent)
Moved to inventory because internal consumption is a stock-out operation.
"""
from django.db import models
from erp.models import TenantModel


class InternalConsumptionEvent(TenantModel):
    """
    Tracks auto-livraison / self-supply events.

    This is a cross-cutting business event:
      - Inventory: goods consumed from stock (INTERNAL_USE movement)
      - Accounting: internal consumption expense
      - Tax: output VAT due on fair market value

    When a company uses its own inventory for internal purposes
    (gifts to employees, internal consumption, marketing samples),
    it must self-assess output VAT on the fair market value.

    Examples:
      - Company uses 10 items (cost 1000) internally → must charge 18% VAT on FMV
      - Company transfers goods between branches with different VAT regimes
      - Construction company uses its own materials on an exempt project
    """

    TRIGGER_CHOICES = [
        ('INTERNAL_USE', 'Internal consumption'),
        ('EMPLOYEE_BENEFIT', 'Employee benefit/gift'),
        ('CROSS_BRANCH', 'Cross-branch (different VAT regime)'),
        ('EXEMPT_PROJECT', 'Used on VAT-exempt project'),
        ('MARKETING', 'Marketing/promotional use'),
        ('OTHER', 'Other'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending assessment'),
        ('ASSESSED', 'VAT assessed'),
        ('DECLARED', 'Included in VAT return'),
        ('CANCELLED', 'Cancelled'),
    ]

    # ── Event Details ────────────────────────────────────────────────
    event_date = models.DateField(help_text='Date of internal consumption event')
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default='INTERNAL_USE')
    description = models.CharField(max_length=500, blank=True, default='')

    # ── Inventory Link ───────────────────────────────────────────────
    warehouse = models.ForeignKey(
        'inventory.Warehouse',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='consumption_events',
        help_text='Warehouse from which goods were consumed')
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='consumption_events',
        help_text='Product consumed internally')
    quantity = models.DecimalField(
        max_digits=15, decimal_places=2, default=1,
        help_text='Quantity consumed')
    department = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Department or cost center consuming the goods')

    # ── Valuation ────────────────────────────────────────────────────
    cost_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Cost/book value of goods used')
    fair_market_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Fair market value for VAT assessment (if > threshold)')
    vat_rate = models.DecimalField(
        max_digits=7, decimal_places=4, default=0,
        help_text='VAT rate applied on self-supply')
    vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Output VAT amount due on self-supply')
    currency_code = models.CharField(max_length=3, default='XOF')

    # ── Status & Journal ─────────────────────────────────────────────
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='PENDING')
    journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='internal_consumption_entries',
        help_text='Journal entry recording the output VAT')

    # ── Meta ─────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        # Keep same table to avoid data migration
        db_table = 'self_supply_vat_event'
        ordering = ['-event_date']
        verbose_name = 'Internal Consumption Event'
        # Use finance app_label because the table was created under finance migrations
        app_label = 'finance'

    def __str__(self):
        return f"Consumption #{self.id} — {self.trigger_type} ({self.vat_amount} {self.currency_code})"
