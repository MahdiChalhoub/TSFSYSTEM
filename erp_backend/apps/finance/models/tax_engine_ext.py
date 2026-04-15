"""
Tax Engine Extension Models
============================
Pure tax rules, compliance tracking, and fiscal event models.

Models that belong here:
  1. WithholdingTaxRule — withholding tax rates per counterparty
  2. BadDebtVATClaim — VAT recovery on unpaid invoices
  3. AdvancePaymentVAT — VAT timing on deposits
  4. CreditNoteVATReversal — VAT adjustment on credit notes
  5. ReverseChargeSelfAssessment — self-assessment for foreign purchases
  6. VATRateChangeHistory — rate change tracking
  7. MarginSchemeTransaction — specialized VAT calculation on resale margin

Models MOVED to their proper business modules:
  - GiftSampleVAT → inventory (GiftSampleEvent)
  - SelfSupplyVATEvent → inventory (InternalConsumptionEvent)
  - ImportDeclaration → pos/procurement (ImportDeclaration)
  - IntraBranchVATTransfer → inventory (fields on StockTransferOrder)

Architecture:
  - All models are TenantModel (org-scoped)
  - Linked to existing entities (CounterpartyTaxProfile, Invoice, Contact)
  - Journal entry generation happens in services, not models
"""
from django.db import models
from erp.models import TenantModel

# ── Backward-compat imports for moved models ─────────────────────────
# These re-exports ensure existing imports don't break during migration
from apps.inventory.models.gift_sample_models import GiftSampleEvent as GiftSampleVAT  # noqa: F401
from apps.inventory.models.internal_consumption_models import InternalConsumptionEvent as SelfSupplyVATEvent  # noqa: F401
from apps.pos.models.import_declaration_models import ImportDeclaration  # noqa: F401


# ═══════════════════════════════════════════════════════════════════════
# 0. Tax Rate Category — per-product VAT rate override
# ═══════════════════════════════════════════════════════════════════════
class TaxRateCategory(TenantModel):
    """
    A named VAT rate that can be attached to individual products.
    When a product has a TaxRateCategory, TaxCalculator.resolve_product_rate()
    uses that rate instead of product.tva_rate.

    Examples:
      - Standard Rate (18%)
      - Zero Rate (0%)
      - Reduced Rate — Food (5%)
      - Exempt

    This replaces the need to hard-code tva_rate on each product for multi-rate
    regimes (UK VAT 5%/20%, Indian GST 5%/12%/18%/28%, Moroccan TVA 7%/10%/14%/20%).
    """

    name = models.CharField(max_length=100, help_text='e.g. "Standard Rate 18%", "Zero Rate"')
    rate = models.DecimalField(
        max_digits=7, decimal_places=4,
        help_text='VAT rate as decimal fraction (e.g. 0.18 for 18%)'
    )
    country_code = models.CharField(
        max_length=3, blank=True, default='',
        help_text='ISO 3166-1 alpha-2 code — informational, not enforced'
    )
    is_default = models.BooleanField(
        default=False,
        help_text='If True, this rate is used when no category is assigned to a product'
    )
    description = models.CharField(max_length=300, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'tax_rate_category'
        ordering = ['-is_default', 'name']
        unique_together = ('organization', 'name')
        verbose_name = 'Tax Rate Category'
        verbose_name_plural = 'Tax Rate Categories'

    def __str__(self):
        return f"{self.name} ({float(self.rate * 100):.2f}%)"

    def save(self, *args, **kwargs):
        if self.is_default:
            TaxRateCategory.objects.filter(
                organization=self.organization, is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)



# ═══════════════════════════════════════════════════════════════════════
class WithholdingTaxRule(TenantModel):
    """
    Defines withholding tax behavior for a counterparty profile.
    When paying/receiving from a counterparty with an active rule,
    the system splits the amount into net + withheld portions.

    Examples:
      - Lebanon: 7.5% on services, 2% on goods
      - CI: 20% on foreign services (AIRSI equivalent)
      - KSA: 5% on foreign payments
    """

    TAX_TYPE_CHOICES = [
        ('INCOME', 'Income Tax Withholding'),
        ('VAT', 'VAT Withholding'),
        ('PROFESSIONAL', 'Professional Tax'),
        ('SERVICES', 'Services Withholding'),
        ('GOODS', 'Goods Withholding'),
        ('FOREIGN', 'Foreign Payment Withholding'),
        ('CUSTOM', 'Custom'),
    ]

    APPLIES_TO_CHOICES = [
        ('PURCHASES', 'On purchases from this counterparty'),
        ('SALES', 'On sales to this counterparty'),
        ('BOTH', 'Both purchases and sales'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('EXPIRED', 'Expired'),
    ]

    # ── Link ─────────────────────────────────────────────────────────
    counterparty_profile = models.ForeignKey(
        'finance.CounterpartyTaxProfile',
        on_delete=models.CASCADE,
        related_name='withholding_rules',
        null=True, blank=True,
        help_text='Counterparty tax profile this rule belongs to')
    contact = models.ForeignKey(
        'crm.Contact',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='withholding_rules',
        help_text='Direct contact link (when no tax profile exists)')

    # ── Rule Definition ──────────────────────────────────────────────
    name = models.CharField(max_length=200, help_text='Rule name, e.g. "Lebanon Services WHT 7.5%"')
    tax_type = models.CharField(max_length=20, choices=TAX_TYPE_CHOICES, default='INCOME')
    rate = models.DecimalField(
        max_digits=7, decimal_places=4,
        help_text='Withholding rate as decimal (e.g. 0.075 for 7.5%)')
    applies_to = models.CharField(max_length=12, choices=APPLIES_TO_CHOICES, default='PURCHASES')

    # ── Thresholds ───────────────────────────────────────────────────
    min_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Minimum transaction amount before WHT applies')
    max_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Maximum WHT amount per transaction (cap)')

    # ── Validity ─────────────────────────────────────────────────────
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='ACTIVE')
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)

    # ── Accounting ───────────────────────────────────────────────────
    debit_account_code = models.CharField(
        max_length=20, blank=True, default='',
        help_text='Account to debit for withheld amount')
    credit_account_code = models.CharField(
        max_length=20, blank=True, default='',
        help_text='Liability account for WHT payable')

    # ── Meta ─────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'withholding_tax_rule'
        ordering = ['-created_at']
        verbose_name = 'Withholding Tax Rule'

    def __str__(self):
        return f"{self.name} ({self.rate * 100:.1f}%)"


# ═══════════════════════════════════════════════════════════════════════
# 2. Bad Debt VAT Claim
# ═══════════════════════════════════════════════════════════════════════
class BadDebtVATClaim(TenantModel):
    """
    Tracks VAT recovery on invoices that were never paid by the customer.

    Flow:
      1. Invoice is issued with output VAT declared
      2. Customer doesn't pay within recovery_period_months
      3. System flags invoice as eligible for bad debt claim
      4. User creates claim → journal reverses output VAT
      5. If customer eventually pays → claim is reversed
    """

    STATUS_CHOICES = [
        ('ELIGIBLE', 'Eligible — awaiting claim'),
        ('CLAIMED', 'Claimed — submitted to tax authority'),
        ('RECOVERED', 'Recovered — VAT refunded/credited'),
        ('REJECTED', 'Rejected — claim denied'),
        ('REVERSED', 'Reversed — customer paid after claim'),
    ]

    # ── Link ─────────────────────────────────────────────────────────
    invoice = models.ForeignKey(
        'finance.Invoice',
        on_delete=models.PROTECT,
        related_name='bad_debt_claims',
        help_text='The unpaid invoice for which VAT recovery is claimed')
    contact = models.ForeignKey(
        'crm.Contact',
        on_delete=models.PROTECT,
        related_name='bad_debt_claims',
        null=True, blank=True,
        help_text='The defaulting customer/client')

    # ── VAT Details ──────────────────────────────────────────────────
    original_vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='The output VAT amount originally declared on this invoice')
    original_invoice_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='The total invoice amount (TTC)')
    vat_rate = models.DecimalField(
        max_digits=7, decimal_places=4,
        help_text='VAT rate at time of original invoice')
    currency_code = models.CharField(max_length=3, default='XOF')

    # ── Claim ────────────────────────────────────────────────────────
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='ELIGIBLE')
    eligible_date = models.DateField(
        null=True, blank=True,
        help_text='Date when claim becomes eligible')
    claim_date = models.DateField(
        null=True, blank=True,
        help_text='Date when claim was actually submitted')
    recovery_date = models.DateField(
        null=True, blank=True,
        help_text='Date when VAT was recovered/refunded')
    recovered_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Actual amount recovered (may differ from original)')

    # ── Journal Link ─────────────────────────────────────────────────
    claim_journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bad_debt_claims',
        help_text='Journal entry created when claim is filed')
    reversal_journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bad_debt_reversals',
        help_text='Journal entry if customer pays after claim (reversal)')

    # ── Meta ─────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'bad_debt_vat_claim'
        ordering = ['-eligible_date']
        verbose_name = 'Bad Debt VAT Claim'

    def __str__(self):
        return f"Bad Debt Claim #{self.id} — {self.original_vat_amount} {self.currency_code} ({self.status})"


# ═══════════════════════════════════════════════════════════════════════
# 3. Advance Payment VAT
# ═══════════════════════════════════════════════════════════════════════
class AdvancePaymentVAT(TenantModel):
    """
    Tracks VAT on advance payments / deposits received before invoice.
    In some jurisdictions, VAT is due when the deposit is received,
    not when the invoice is issued.
    """

    STATUS_CHOICES = [
        ('PENDING', 'Deposit received — VAT not yet declared'),
        ('VAT_DECLARED', 'VAT declared on deposit'),
        ('INVOICED', 'Invoice issued — VAT adjusted'),
        ('CANCELLED', 'Deposit cancelled/refunded'),
    ]

    # ── Link ─────────────────────────────────────────────────────────
    contact = models.ForeignKey(
        'crm.Contact',
        on_delete=models.PROTECT,
        related_name='advance_payment_vat',
        help_text='Customer who made the deposit')
    payment = models.ForeignKey(
        'finance.Payment',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='advance_vat_records',
        help_text='The advance payment that triggered VAT')
    invoice = models.ForeignKey(
        'finance.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='advance_vat_records',
        help_text='The final invoice that supersedes deposit VAT')

    # ── Amounts ──────────────────────────────────────────────────────
    deposit_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Gross deposit amount received (TTC)')
    deposit_ht = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Deposit amount excluding VAT')
    vat_rate = models.DecimalField(
        max_digits=7, decimal_places=4,
        help_text='VAT rate applicable')
    vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='VAT due on the deposit')
    currency_code = models.CharField(max_length=3, default='XOF')

    # ── Dates & Status ───────────────────────────────────────────────
    deposit_date = models.DateField(help_text='Date deposit was received')
    invoice_date = models.DateField(null=True, blank=True, help_text='Date final invoice was issued')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='PENDING')

    # ── Journal Link ─────────────────────────────────────────────────
    deposit_journal = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='advance_deposit_entries',
        help_text='JE for deposit VAT declaration')
    adjustment_journal = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='advance_adjustment_entries',
        help_text='JE for adjustment when invoice is issued')

    # ── Meta ─────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'advance_payment_vat'
        ordering = ['-deposit_date']
        verbose_name = 'Advance Payment VAT'

    def __str__(self):
        return f"Advance VAT #{self.id} — {self.deposit_amount} ({self.status})"


# ═══════════════════════════════════════════════════════════════════════
# 4. Credit Note VAT Reversal
# ═══════════════════════════════════════════════════════════════════════
class CreditNoteVATReversal(TenantModel):
    """
    Tracks the VAT implications of credit notes and refunds.
    """

    REVERSAL_TYPE_CHOICES = [
        ('FULL', 'Full credit — entire invoice reversed'),
        ('PARTIAL', 'Partial credit — specific lines or amounts'),
        ('CORRECTION', 'Correction — original invoice had errors'),
        ('DISCOUNT', 'Post-sale discount or rebate'),
    ]

    # ── Link ─────────────────────────────────────────────────────────
    original_invoice = models.ForeignKey(
        'finance.Invoice',
        on_delete=models.PROTECT,
        related_name='vat_reversals',
        help_text='The original invoice being credited')
    credit_note = models.ForeignKey(
        'pos.CreditNote',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='vat_reversals',
        help_text='The credit note document')

    # ── Amounts ──────────────────────────────────────────────────────
    reversal_type = models.CharField(max_length=12, choices=REVERSAL_TYPE_CHOICES, default='FULL')
    original_vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='VAT on the original invoice')
    reversed_vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='VAT being reversed by this credit note')
    credit_amount_ht = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Credit note amount excluding VAT')
    vat_rate = models.DecimalField(
        max_digits=7, decimal_places=4,
        help_text='VAT rate')
    currency_code = models.CharField(max_length=3, default='XOF')

    # ── Declaration ──────────────────────────────────────────────────
    is_output_adjustment = models.BooleanField(
        default=True,
        help_text='True = reduces output VAT (seller), False = reduces input VAT (buyer)')
    vat_return_period = models.CharField(
        max_length=20, blank=True, default='',
        help_text='VAT return period this reversal will be included in')

    # ── Journal Link ─────────────────────────────────────────────────
    journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='credit_note_vat_reversals')

    # ── Meta ─────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'credit_note_vat_reversal'
        ordering = ['-created_at']
        verbose_name = 'Credit Note VAT Reversal'

    def __str__(self):
        return f"VAT Reversal #{self.id} — {self.reversed_vat_amount} ({self.reversal_type})"


# ═══════════════════════════════════════════════════════════════════════
# 5. Margin Scheme Transaction (stays in finance — specialized VAT calc)
# ═══════════════════════════════════════════════════════════════════════
class MarginSchemeTransaction(TenantModel):
    """
    VAT on Margin (Régime de la marge):
    Instead of charging VAT on the full sale price, VAT is calculated
    only on the profit margin (sale_price - purchase_price).

    Used for: second-hand goods, art/antiques, travel agencies, real estate.

    Tax base = Sale Price HT - Purchase Price HT
    VAT due  = margin * vat_rate
    """

    SCHEME_CHOICES = [
        ('SECOND_HAND', 'Second-Hand Goods'),
        ('ART_ANTIQUE', 'Art & Antiques'),
        ('TRAVEL', 'Travel / Tour Operator'),
        ('REAL_ESTATE', 'Real Estate'),
        ('VEHICLE', 'Used Vehicles'),
        ('OTHER', 'Other Margin Scheme'),
    ]

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CALCULATED', 'Margin Calculated'),
        ('DECLARED', 'Declared in VAT Return'),
        ('CANCELLED', 'Cancelled'),
    ]

    # ── Identity ─────────────────────────────────────────────────────
    transaction_date = models.DateField()
    scheme_type = models.CharField(max_length=20, choices=SCHEME_CHOICES, default='SECOND_HAND')
    reference = models.CharField(max_length=100, blank=True, default='',
        help_text='Sale invoice or transaction reference')
    description = models.CharField(max_length=500, blank=True, default='')

    # ── Purchase Side ────────────────────────────────────────────────
    purchase_price_ht = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Original purchase price HT')
    purchase_date = models.DateField(null=True, blank=True)
    purchase_reference = models.CharField(max_length=100, blank=True, default='',
        help_text='Purchase invoice reference')
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='margin_supplier_txns')

    # ── Sale Side ────────────────────────────────────────────────────
    sale_price_ht = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Sale price HT')
    buyer = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='margin_buyer_txns')

    # ── Margin Calculation ───────────────────────────────────────────
    vat_rate = models.DecimalField(max_digits=7, decimal_places=4, default=0)
    currency_code = models.CharField(max_length=3, default='XOF')

    @property
    def margin(self):
        """Taxable margin = sale - purchase (floor 0)."""
        return max(self.sale_price_ht - self.purchase_price_ht, 0)

    @property
    def vat_on_margin(self):
        """VAT calculated on margin only."""
        return self.margin * self.vat_rate

    # ── Status & Journal ─────────────────────────────────────────────
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='margin_scheme_entries')

    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'margin_scheme_transaction'
        ordering = ['-transaction_date']
        verbose_name = 'Margin Scheme Transaction'

    def __str__(self):
        return f"Margin #{self.id} — {self.scheme_type} margin={self.margin} VAT={self.vat_on_margin}"


# ═══════════════════════════════════════════════════════════════════════
# 6. Reverse Charge Self-Assessment
# ═══════════════════════════════════════════════════════════════════════
class ReverseChargeSelfAssessment(TenantModel):
    """
    When purchasing from a foreign supplier who doesn't charge local VAT,
    the buyer must self-assess VAT.

    Key formula:
      Output VAT (self-assessed) = purchase_amount_ht * local_vat_rate
      Input VAT (deductible)     = output_vat * recovery_rate
      Net cost                   = output_vat - input_vat
    """

    TRIGGER_CHOICES = [
        ('FOREIGN_SERVICE', 'Foreign Service Import'),
        ('FOREIGN_GOODS', 'Foreign Goods (No VAT Charged)'),
        ('INTRA_COMMUNITY', 'Intra-Community Acquisition (EU)'),
        ('DIGITAL_SERVICE', 'Digital Service Import'),
        ('CONSTRUCTION', 'Construction Reverse Charge'),
        ('OTHER', 'Other Reverse Charge'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending Assessment'),
        ('ASSESSED', 'Self-Assessed'),
        ('DECLARED', 'Declared in VAT Return'),
        ('CANCELLED', 'Cancelled'),
    ]

    # ── Transaction ──────────────────────────────────────────────────
    assessment_date = models.DateField()
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default='FOREIGN_SERVICE')
    description = models.CharField(max_length=500, blank=True, default='')

    # ── Supplier & Invoice ───────────────────────────────────────────
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reverse_charge_assessments')
    supplier_invoice_ref = models.CharField(max_length=100, blank=True, default='',
        help_text='Foreign supplier invoice reference')
    supplier_country = models.CharField(max_length=3, blank=True, default='',
        help_text='ISO 3166-1 alpha-2 country code')

    # ── Values ───────────────────────────────────────────────────────
    purchase_amount_ht = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Purchase amount before VAT (HT)')
    local_vat_rate = models.DecimalField(
        max_digits=7, decimal_places=4, default=0,
        help_text='Local VAT rate to self-assess')
    output_vat = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Self-assessed output VAT')
    recovery_rate = models.DecimalField(
        max_digits=7, decimal_places=4, default=1.0,
        help_text='Input VAT recovery rate (1.0 = 100%)')
    input_vat = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Recoverable input VAT')
    net_vat_cost = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Net VAT cost = output - input (0 if fully recoverable)')
    currency_code = models.CharField(max_length=3, default='XOF')

    # ── Status & Journal ─────────────────────────────────────────────
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    output_journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reverse_charge_output_entries')
    input_journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reverse_charge_input_entries')

    notes = models.TextField(blank=True, default='')
    vat_return_period = models.CharField(max_length=20, blank=True, default='',
        help_text='e.g. 2026-Q1')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'reverse_charge_self_assessment'
        ordering = ['-assessment_date']
        verbose_name = 'Reverse Charge Self-Assessment'

    def __str__(self):
        return f"Reverse Charge #{self.id} — {self.trigger_type} {self.purchase_amount_ht} ({self.status})"


# ═══════════════════════════════════════════════════════════════════════
# 7. VAT Rate Change History
# ═══════════════════════════════════════════════════════════════════════
class VATRateChangeHistory(TenantModel):
    """
    Tracks historical VAT rate changes for auditing and transition management.
    """

    TRANSITION_RULES = [
        ('INVOICE_DATE', 'Based on Invoice Date'),
        ('DELIVERY_DATE', 'Based on Delivery Date'),
        ('PAYMENT_DATE', 'Based on Payment Date'),
        ('EARLIER_OF', 'Earlier of Invoice/Delivery'),
        ('GOVERNMENT_DECREE', 'Per Government Decree'),
    ]

    STATUS_CHOICES = [
        ('UPCOMING', 'Upcoming Change'),
        ('ACTIVE', 'Currently Active Rate'),
        ('HISTORICAL', 'Historical Rate'),
    ]

    # ── Rate Change ──────────────────────────────────────────────────
    tax_group = models.ForeignKey(
        'finance.TaxGroup',
        on_delete=models.CASCADE,
        related_name='rate_history',
        help_text='The tax group whose rate changed')
    country_code = models.CharField(max_length=3, default='',
        help_text='ISO 3166-1 alpha-2 country code')
    description = models.CharField(max_length=500, blank=True, default='',
        help_text='e.g. "Lebanon VAT increase from 11% to 12%"')

    # ── Old Rate ─────────────────────────────────────────────────────
    old_rate = models.DecimalField(
        max_digits=7, decimal_places=4, default=0,
        help_text='Previous VAT rate (decimal, e.g. 0.11)')
    old_rate_label = models.CharField(max_length=50, blank=True, default='',
        help_text='e.g. "11% Standard Rate"')

    # ── New Rate ─────────────────────────────────────────────────────
    new_rate = models.DecimalField(
        max_digits=7, decimal_places=4, default=0,
        help_text='New VAT rate (decimal, e.g. 0.12)')
    new_rate_label = models.CharField(max_length=50, blank=True, default='',
        help_text='e.g. "12% Standard Rate"')

    # ── Timing ───────────────────────────────────────────────────────
    effective_date = models.DateField(
        help_text='Date the new rate becomes effective')
    announcement_date = models.DateField(
        null=True, blank=True,
        help_text='Date the change was officially announced')
    gazette_reference = models.CharField(max_length=200, blank=True, default='',
        help_text='Official gazette or decree reference')

    # ── Transition Rules ─────────────────────────────────────────────
    transition_rule = models.CharField(
        max_length=20, choices=TRANSITION_RULES, default='INVOICE_DATE',
        help_text='How to determine which rate applies for transitional transactions')
    transition_notes = models.TextField(blank=True, default='',
        help_text='Detailed transitional rules and exceptions')

    # ── Status ───────────────────────────────────────────────────────
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UPCOMING')
    applied_to_tax_group = models.BooleanField(default=False,
        help_text='Whether the TaxGroup.rate has been updated to new_rate')

    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'vat_rate_change_history'
        ordering = ['-effective_date']
        verbose_name = 'VAT Rate Change'
        verbose_name_plural = 'VAT Rate Change History'

    def __str__(self):
        return f"Rate Change #{self.id} — {self.old_rate*100:.1f}%→{self.new_rate*100:.1f}% ({self.effective_date})"


# ═══════════════════════════════════════════════════════════════════════
# DEPRECATED: IntraBranchVATTransfer
# VAT fields now live on StockTransferOrder (inventory module)
# Keeping this model temporarily for backward compatibility
# ═══════════════════════════════════════════════════════════════════════
class IntraBranchVATTransfer(TenantModel):
    """
    DEPRECATED: Use StockTransferOrder VAT fields instead.

    This model tracked VAT implications of branch-to-branch transfers
    separately from the actual stock transfer. This was architecturally wrong —
    the VAT assessment should be part of the transfer itself.

    Kept for backward compatibility during migration period.
    """

    TRANSFER_TYPE_CHOICES = [
        ('SAME_JURISDICTION', 'Same Jurisdiction (no VAT impact)'),
        ('CROSS_JURISDICTION', 'Cross Jurisdiction (VAT adjustment)'),
        ('FREE_ZONE_IN', 'Into Free Trade Zone (VAT exempt)'),
        ('FREE_ZONE_OUT', 'Out of Free Trade Zone (VAT applies)'),
        ('CROSS_BORDER', 'Cross-Border Inter-company'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'VAT Treatment Approved'),
        ('ADJUSTED', 'VAT Adjusted'),
        ('NO_ACTION', 'No VAT Action Required'),
    ]

    transfer_date = models.DateField()
    transfer_type = models.CharField(max_length=20, choices=TRANSFER_TYPE_CHOICES, default='SAME_JURISDICTION')
    transfer_reference = models.CharField(max_length=100, blank=True, default='')
    description = models.CharField(max_length=500, blank=True, default='')

    source_branch = models.CharField(max_length=200, blank=True, default='')
    source_vat_registration = models.CharField(max_length=50, blank=True, default='')
    destination_branch = models.CharField(max_length=200, blank=True, default='')
    destination_vat_registration = models.CharField(max_length=50, blank=True, default='')

    goods_value = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_rate_source = models.DecimalField(max_digits=7, decimal_places=4, default=0)
    vat_rate_destination = models.DecimalField(max_digits=7, decimal_places=4, default=0)
    vat_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    currency_code = models.CharField(max_length=3, default='XOF')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    journal_entry = models.ForeignKey(
        'finance.JournalEntry',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='intra_branch_vat_entries')

    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'intra_branch_vat_transfer'
        ordering = ['-transfer_date']
        verbose_name = 'Intra-Branch VAT Transfer (DEPRECATED)'

    def __str__(self):
        return f"Branch VAT #{self.id} — {self.source_branch}→{self.destination_branch} ({self.transfer_type})"
