"""
Import Declaration Models
=========================
Business events for international purchase customs clearance.

These are procurement events first (goods arrive at customs),
with tax and inventory costing implications.

Previously in: finance/models/tax_engine_ext.py (ImportDeclaration)
Moved to procurement because imports are goods receipt operations
with landed cost → product costing flows.
"""
from django.db import models
from erp.models import TenantModel


class ImportDeclaration(TenantModel):
    """
    Tracks import duties, import VAT, and landed cost for international purchases.

    This is a cross-cutting business event:
      - Procurement: goods received from foreign supplier
      - Inventory: landed cost flows into product valuation
      - Accounting: customs duties + import VAT journal entries
      - Tax: import VAT recovery in VAT declaration

    Separate from domestic VAT: import VAT is paid at customs, may be recoverable
    depending on org policy. Customs duties are always capitalized into cost.

    Landed Cost = CIF Value + Customs Duties + Import VAT (if not recoverable)
                  + Other Charges (inspection, port, etc.)

    Flow:
      1. PO is placed with foreign supplier
      2. Goods arrive at customs → ImportDeclaration created
      3. Customs duties + import VAT calculated on CIF value
      4. Landed cost flows into inventory valuation
      5. Import VAT recovery (if applicable) flows to VAT declaration
    """

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ASSESSED', 'Assessed by customs'),
        ('PAID', 'Duties & VAT paid'),
        ('CLEARED', 'Goods cleared'),
        ('CANCELLED', 'Cancelled'),
    ]

    # ── Link ─────────────────────────────────────────────────────────
    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='import_declarations',
        help_text='The purchase order for the imported goods')

    # ── Identity ─────────────────────────────────────────────────────
    declaration_number = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Customs declaration number / reference')
    origin_country = models.CharField(
        max_length=3, default='',
        help_text='Country of origin (ISO 3166-1)')
    destination_country = models.CharField(
        max_length=3, default='',
        help_text='Import destination country')
    declaration_date = models.DateField(
        null=True, blank=True,
        help_text='Date of customs assessment')
    clearance_date = models.DateField(
        null=True, blank=True,
        help_text='Date goods were released from customs')

    # ── CIF Value ────────────────────────────────────────────────────
    fob_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Free On Board value (goods cost at origin)')
    freight_cost = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Shipping/freight cost')
    insurance_cost = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Insurance cost')
    currency_code = models.CharField(max_length=3, default='USD')

    @property
    def cif_value(self):
        """Cost + Insurance + Freight"""
        return self.fob_value + self.freight_cost + self.insurance_cost

    # ── Customs Duties ───────────────────────────────────────────────
    customs_duty_rate = models.DecimalField(
        max_digits=7, decimal_places=4, default=0,
        help_text='Customs duty rate (e.g., 0.2000 for 20%)')
    customs_duty_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Customs duty amount (calculated or overridden)')
    customs_duty_treatment = models.CharField(
        max_length=20, default='CAPITALIZE',
        choices=[
            ('CAPITALIZE', 'Capitalize into inventory cost'),
            ('EXPENSE', 'Expense to P&L'),
        ],
        help_text='How customs duties affect cost')

    # ── Import VAT ───────────────────────────────────────────────────
    import_vat_rate = models.DecimalField(
        max_digits=7, decimal_places=4, default=0,
        help_text='Import VAT rate (e.g., 0.1800 for 18%)')
    import_vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Import VAT amount')
    import_vat_base = models.CharField(
        max_length=20, default='CIF_PLUS_DUTY',
        choices=[
            ('CIF', 'VAT on CIF value only'),
            ('CIF_PLUS_DUTY', 'VAT on CIF + customs duty'),
        ],
        help_text='What the import VAT is calculated on')
    import_vat_recoverable = models.BooleanField(
        default=True,
        help_text='Can this import VAT be recovered in VAT declaration?')

    # ── Other Charges ────────────────────────────────────────────────
    other_charges = models.JSONField(
        default=list, blank=True,
        help_text='Additional charges: [{name, amount, capitalize}]')
    other_charges_total = models.DecimalField(
        max_digits=15, decimal_places=2, default=0)

    # ── Landed Cost ──────────────────────────────────────────────────
    @property
    def total_landed_cost(self):
        """
        Total cost of goods after all duties, taxes, and charges.
        Import VAT = part of cost ONLY if not recoverable.
        """
        cost = self.cif_value
        if self.customs_duty_treatment == 'CAPITALIZE':
            cost += self.customs_duty_amount
        if not self.import_vat_recoverable:
            cost += self.import_vat_amount
        for charge in (self.other_charges or []):
            if charge.get('capitalize', True):
                cost += charge.get('amount', 0)
        return cost

    # ── Status & Journal ─────────────────────────────────────────────
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='DRAFT')
    journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='import_declarations',
        help_text='Journal entry recording customs duties and import VAT')

    # ── Meta ─────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        # Keep same table to avoid data migration
        db_table = 'import_declaration'
        ordering = ['-declaration_date']
        verbose_name = 'Import Declaration'
        # Use finance app_label because the table was created under finance migrations
        app_label = 'finance'

    def __str__(self):
        return f"Import {self.declaration_number or f'#{self.id}'} — {self.origin_country}→{self.destination_country}"
