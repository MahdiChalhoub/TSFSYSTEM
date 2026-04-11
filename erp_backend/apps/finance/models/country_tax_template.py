"""
CountryTaxTemplate
==================
SaaS-level (global, NOT tenant-scoped) template that provides country-specific
defaults for Org Tax Policies and Counterparty Tax Profiles.

Created and managed by SaaS admin. Organizations consume templates when
creating new tax configuration entities.

Flow:
  1. SaaS admin creates template for each country (seed or UI)
  2. Org user creates new OrgTaxPolicy → picks country → fields auto-fill
  3. Org user creates new CounterpartyTaxProfile → picks country → docs auto-fill
  4. User can customize everything after auto-fill
"""
from django.db import models


class CountryTaxTemplate(models.Model):
    """
    Global (non-tenant) template holding country-specific tax defaults.
    NOT a TenantModel — shared across all organizations.
    """

    # ── Identity ──────────────────────────────────────────────────────
    country_code = models.CharField(
        max_length=3, unique=True,
        help_text='ISO 3166-1 alpha-2 or alpha-3 code (e.g. CI, FR, US)')
    country_name = models.CharField(
        max_length=100,
        help_text='Human-readable country name')
    currency_code = models.CharField(
        max_length=3, default='USD',
        help_text='Default currency ISO code')

    # ── Org Tax Policy Presets ─────────────────────────────────────────
    # JSON array of preset dicts, each matching OrgTaxPolicy fields + a 'name'.
    org_policy_defaults = models.JSONField(
        default=list, blank=True,
        help_text=(
            'Array of org tax policy presets for this country. '
            'Each entry: {"name": "Standard VAT", "vat_output_enabled": true, ...}. '
            'Keys must match OrgTaxPolicy field names.'
        )
    )

    # ── Document Requirements Template ────────────────────────────────
    # Structured list applied to new CounterpartyTaxProfile.required_documents
    document_requirements = models.JSONField(
        default=list, blank=True,
        help_text=(
            'Default document requirements for counterparty profiles. '
            'Each entry: {"type": "TAX_ID", "label": "...", "required": true, '
            '"renewable": false, "renewal_months": null}'
        )
    )

    # ── Counterparty Profile Presets ──────────────────────────────────
    # Seed profiles created for orgs using this country
    counterparty_presets = models.JSONField(
        default=list, blank=True,
        help_text=(
            'Default counterparty tax profiles to seed for this country. '
            'Each entry: {"name": "...", "vat_registered": true, ...}'
        )
    )

    # ── Tax Group Presets ─────────────────────────────────────────────
    # Standard tax rates seeded into org's TaxGroup table
    tax_group_presets = models.JSONField(
        default=list, blank=True,
        help_text=(
            'Default tax groups to seed for this country. '
            'Each entry: {"name": "TVA Standard", "rate": "18.00", '
            '"tax_type": "STANDARD", "is_default": true, "description": "..."}'
        )
    )

    # ── Custom Tax Rule Presets ───────────────────────────────────────
    # Country-specific custom taxes (Eco Tax, Tourism Levy, AIRSI, etc.)
    custom_tax_rule_presets = models.JSONField(
        default=list, blank=True,
        help_text=(
            'Default custom tax rules for this country. '
            'Each entry: {"name": "...", "rate": "0.0100", '
            '"transaction_type": "BOTH", "math_behavior": "ADDED_TO_TTC", ...}'
        )
    )

    # ── Advanced Settings ─────────────────────────────────────────────
    bad_debt_recovery_months = models.PositiveIntegerField(
        default=12,
        help_text='Months after invoice due date before bad debt VAT claim is eligible')
    self_supply_vat_threshold = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Minimum value for self-supply VAT to apply (auto-livraison)')
    vat_on_advance_payment = models.BooleanField(
        default=False,
        help_text='Whether VAT is due when advance payment/deposit is received')
    gift_vat_threshold = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Value above which gifts/samples trigger output VAT')

    # ── E-Invoicing ────────────────────────────────────────────────────
    e_invoice_standard = models.ForeignKey(
        'finance.EInvoiceStandard', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='country_templates',
        help_text='E-invoicing standard for this country (e.g. FNE for CI, ZATCA for SA)'
    )
    EINVOICE_ENFORCEMENT_CHOICES = [
        ('NONE', 'None — No e-invoicing'),
        ('OPTIONAL', 'Optional — Tenant can choose'),
        ('RECOMMENDED', 'Recommended — Shown as default'),
        ('MANDATORY', 'Mandatory — Required by law'),
    ]
    einvoice_enforcement = models.CharField(
        max_length=20, default='OPTIONAL', choices=EINVOICE_ENFORCEMENT_CHOICES,
        help_text='How strictly e-invoicing is enforced for this country'
    )

    # ── Meta ──────────────────────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'country_tax_template'
        ordering = ['country_code']
        verbose_name = 'Country Tax Template'
        verbose_name_plural = 'Country Tax Templates'

    def __str__(self):
        return f"{self.country_code} — {self.country_name}"
