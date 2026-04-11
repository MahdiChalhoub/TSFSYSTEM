"""
Gift / Sample Event Models
==========================
Business events for gifts, samples, and promotional items.

These are inventory events first (goods leave the warehouse),
with VAT implications calculated by the tax engine.

Previously in: finance/models/tax_engine_ext.py (GiftSampleVAT)
Moved to inventory because gifts are stock-out operations.
"""
from django.db import models
from erp.models import TenantModel


class GiftSampleEvent(TenantModel):
    """
    Tracks gifts, free samples, and promotional items given to customers.

    This is a cross-cutting business event:
      - Inventory: stock leaves the warehouse (GIFT_OUT movement)
      - Accounting: expense journal entry
      - Tax: output VAT due if value exceeds country threshold

    In most jurisdictions, if the value exceeds a threshold (per recipient per year),
    output VAT must be charged on the cost/market value.

    Examples:
      - France: gifts > €73/person/year → VAT due
      - CI: all gifts above threshold → VAT on cost
      - UK: gifts > £50 → VAT on cost
    """

    GIFT_TYPE_CHOICES = [
        ('GIFT', 'Business gift to client/partner'),
        ('SAMPLE', 'Product sample'),
        ('PROMOTIONAL', 'Promotional item'),
        ('EMPLOYEE', 'Employee gift/perk'),
        ('CHARITY', 'Charitable donation (in kind)'),
    ]

    STATUS_CHOICES = [
        ('BELOW_THRESHOLD', 'Below threshold — no VAT'),
        ('VAT_DUE', 'Above threshold — VAT assessed'),
        ('DECLARED', 'VAT included in return'),
    ]

    # ── Event Details ────────────────────────────────────────────────
    gift_date = models.DateField(help_text='Date of gift/sample')
    gift_type = models.CharField(max_length=16, choices=GIFT_TYPE_CHOICES, default='GIFT')
    description = models.CharField(max_length=500, blank=True, default='')

    # ── Recipient ────────────────────────────────────────────────────
    recipient_contact = models.ForeignKey(
        'crm.Contact',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='received_gifts',
        help_text='Contact who received the gift')
    recipient_name = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Name if not a CRM contact')

    # ── Inventory Link ───────────────────────────────────────────────
    warehouse = models.ForeignKey(
        'inventory.Warehouse',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='gift_events',
        help_text='Warehouse from which goods were issued')
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='gift_events',
        help_text='Product gifted (if single product)')
    quantity = models.DecimalField(
        max_digits=15, decimal_places=2, default=1,
        help_text='Quantity of items gifted')

    # ── Values ───────────────────────────────────────────────────────
    cost_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Cost/book value of items gifted')
    market_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Fair market value (used for VAT base if required)')
    cumulative_value_ytd = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Year-to-date cumulative gift value to this recipient')
    threshold = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Country threshold for gift VAT')
    vat_rate = models.DecimalField(
        max_digits=7, decimal_places=4, default=0)
    vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Output VAT due (if above threshold)')
    currency_code = models.CharField(max_length=3, default='XOF')

    # ── Status & Journal ─────────────────────────────────────────────
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='BELOW_THRESHOLD')
    journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='gift_sample_entries')

    # ── Meta ─────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        # Keep same table to avoid data migration
        db_table = 'gift_sample_vat'
        ordering = ['-gift_date']
        verbose_name = 'Gift/Sample Event'
        # Use finance app_label because the table was created under finance migrations
        app_label = 'finance'

    def __str__(self):
        return f"Gift #{self.id} — {self.gift_type} {self.cost_value} ({self.status})"
