"""
OrgTaxPolicy
============
Defines HOW YOUR ORGANIZATION behaves fiscally.

Applies to: Organization (chosen per branch or globally)
NOT for suppliers or clients — use CounterpartyTaxProfile for those.

Key fields:
- vat_output_enabled        : do you CHARGE VAT on official sales?
- vat_input_recoverability  : how much input VAT you can reclaim (0.0→1.0)
- airsi_treatment           : how AIRSI withholding is posted (CAPITALIZE/RECOVER/EXPENSE)
- internal_cost_mode        : how internal-scope purchases are costed
"""
from decimal import Decimal
from django.db import models
from erp.models import TenantModel


class OrgTaxPolicy(TenantModel):

    AIRSI_TREATMENT = (
        ('CAPITALIZE', 'Capitalize into inventory cost'),
        ('RECOVER',    'Book as AIRSI Récupérable (offsets profit tax)'),
        ('EXPENSE',    'Expense to P&L'),
    )

    PURCHASE_TAX_MODE = (
        ('CAPITALIZE', 'Add to inventory cost'),
        ('EXPENSE',    'Expense to P&L'),
    )

    SALES_TAX_TRIGGER = (
        ('ON_TURNOVER', 'Percentage of total revenue (period)'),
        ('ON_PROFIT',   'Percentage of gross profit (period)'),
    )

    PROFIT_TAX_MODE = (
        ('STANDARD', 'Standard corporate tax'),
        ('FORFAIT',  'Fixed/forfait tax'),
        ('EXEMPT',   'Tax exempt'),
    )

    INTERNAL_COST_MODE = (
        ('TTC_ALWAYS',       'Internal scope always uses TTC as cost'),
        ('SAME_AS_OFFICIAL', 'Internal scope follows same recoverability as official'),
        ('CUSTOM',           'Custom logic (override in code)'),
    )

    INTERNAL_SALES_VAT_MODE = (
        ('NONE',         'No VAT — totals are HT only'),
        ('DISPLAY_ONLY', 'Show VAT in UI, but no statutory liability in ledger'),
    )

    # ── Identity ──────────────────────────────────────────────────────
    name = models.CharField(max_length=150,
                            help_text='e.g. "Standard VAT Policy", "Micro Regime"')
    is_default = models.BooleanField(default=False)
    country_code = models.CharField(max_length=3, default='CI',
                                    help_text='ISO 3166-1 alpha-2/3 country code')
    currency_code = models.CharField(max_length=3, default='XOF')

    # ── VAT Output (sales) ────────────────────────────────────────────
    vat_output_enabled = models.BooleanField(
        default=True,
        help_text='True = you charge VAT on OFFICIAL scope sales'
    )

    # ── VAT Input (purchases) ─────────────────────────────────────────
    vat_input_recoverability = models.DecimalField(
        max_digits=4, decimal_places=3, default=Decimal('1.000'),
        help_text='0.000=none, 0.500=50%, 1.000=fully refundable'
    )

    VAT_TREATMENT = (
        ('RECOVERABLE', 'Recoverable / Standard'),
        ('CAPITALIZE',  'Capitalize into cost (Expense/Asset)'),
        ('EXPENSE',     'Expense to P&L'),
    )

    official_vat_treatment = models.CharField(
        max_length=15, choices=VAT_TREATMENT, default='RECOVERABLE',
        help_text='How VAT is treated on official purchases (default: RECOVERABLE)'
    )
    internal_vat_treatment = models.CharField(
        max_length=15, choices=VAT_TREATMENT, default='CAPITALIZE',
        help_text='How VAT is treated on internal purchases (default: CAPITALIZE)'
    )

    # ── AIRSI ─────────────────────────────────────────────────────────
    airsi_treatment = models.CharField(
        max_length=12, choices=AIRSI_TREATMENT, default='CAPITALIZE'
    )

    # ── Purchase Tax ──────────────────────────────────────────────────
    purchase_tax_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=Decimal('0.0000'),
        help_text='e.g. 0.0200 for 2% purchase tax'
    )
    purchase_tax_mode = models.CharField(
        max_length=12, choices=PURCHASE_TAX_MODE, default='CAPITALIZE'
    )

    # ── Sales / Turnover Tax (periodic only) ─────────────────────────
    sales_tax_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=Decimal('0.0000')
    )
    sales_tax_trigger = models.CharField(
        max_length=12, choices=SALES_TAX_TRIGGER, default='ON_TURNOVER'
    )

    # ── Periodic / Forfait ────────────────────────────────────────────
    periodic_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Fixed periodic tax amount (forfait, minimum légal)'
    )
    periodic_interval = models.CharField(
        max_length=10,
        choices=[('MONTHLY', 'Monthly'), ('ANNUAL', 'Annual')],
        default='ANNUAL'
    )

    # ── Profit Tax ────────────────────────────────────────────────────
    profit_tax_mode = models.CharField(
        max_length=10, choices=PROFIT_TAX_MODE, default='STANDARD'
    )

    # ── Scope ─────────────────────────────────────────────────────────
    allowed_scopes = models.JSONField(
        default=list,
        help_text='e.g. ["OFFICIAL"] or ["OFFICIAL","INTERNAL"]'
    )

    # ── Internal cost rule ────────────────────────────────────────────
    internal_cost_mode = models.CharField(
        max_length=20, choices=INTERNAL_COST_MODE, default='TTC_ALWAYS'
    )

    # ── Internal sales VAT rule ───────────────────────────────────────
    internal_sales_vat_mode = models.CharField(
        max_length=15, choices=INTERNAL_SALES_VAT_MODE, default='NONE',
        help_text=(
            'NONE: INTERNAL sales totals are HT only. '
            'DISPLAY_ONLY: VAT shown in UI but never posted as a statutory liability.'
        )
    )

    # ── Tax Account Links (centralized GL resolution) ─────────────────
    # These FK fields make the Tax Engine the single source of truth
    # for tax-related GL accounts, replacing standalone posting rules.
    vat_collected_account = models.ForeignKey(
        'ChartOfAccount', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='tax_policy_vat_collected',
        help_text='Output VAT liability on sales invoices (TVA Collectée)')
    vat_recoverable_account = models.ForeignKey(
        'ChartOfAccount', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='tax_policy_vat_recoverable',
        help_text='Input VAT asset on purchases (TVA Récupérable)')
    vat_payable_account = models.ForeignKey(
        'ChartOfAccount', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='tax_policy_vat_payable',
        help_text='Net VAT due clearing account for settlement')
    vat_refund_receivable_account = models.ForeignKey(
        'ChartOfAccount', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='tax_policy_vat_refund',
        help_text='VAT credit receivable when input > output')
    vat_suspense_account = models.ForeignKey(
        'ChartOfAccount', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='tax_policy_vat_suspense',
        help_text='VAT suspense for cash-basis accounting')
    airsi_account = models.ForeignKey(
        'ChartOfAccount', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='tax_policy_airsi',
        help_text='AIRSI withholding: LIABILITY if non-refundable, ASSET if RECOVER')
    reverse_charge_account = models.ForeignKey(
        'ChartOfAccount', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='tax_policy_reverse_charge',
        help_text='Reverse charge / autoliquidation VAT account')

    # ── Audit ─────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'org_tax_policy'
        ordering = ['-is_default', 'name']
        unique_together = ('name', 'organization')

    def __str__(self):
        return f"{self.name} ({self.organization})"

    def save(self, *args, **kwargs):
        # Enforce one default per org
        if self.is_default:
            OrgTaxPolicy.objects.filter(
                organization=self.organization, is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    # ── Helpers ────────────────────────────────────────────────────────

    def get_vat_cost_impact_ratio(self) -> Decimal:
        """Portion of input VAT added to inventory cost."""
        return Decimal('1.000') - self.vat_input_recoverability

    def allows_scope(self, scope: str) -> bool:
        scopes = self.allowed_scopes or ['OFFICIAL']
        return scope in scopes
