"""
TaxJurisdictionRule
===================
Configurable rule source for destination-based tax resolution.

Each rule maps a (country, region, tax_type) combination to a specific
rate, reverse charge behavior, and zero-rate export handling.

This replaces hardcoded country-specific tax logic with a data-driven
approach. Rules are tenant-scoped (org-specific) or system presets.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class TaxJurisdictionRule(TenantModel):
    """
    Data-driven tax jurisdiction rules.
    Used by JurisdictionResolverService to determine effective tax behavior
    based on origin, destination, and transaction type.
    """

    PLACE_OF_SUPPLY_MODES = [
        ('ORIGIN', 'Tax based on seller location'),
        ('DESTINATION', 'Tax based on buyer/delivery location'),
        ('REVERSE_CHARGE', 'Buyer self-assesses (B2B cross-border)'),
    ]

    TAX_TYPE_CHOICES = [
        ('VAT', 'Value Added Tax'),
        ('SALES_TAX', 'Sales Tax'),
        ('GST', 'Goods & Services Tax'),
        ('EXCISE', 'Excise Duty'),
        ('WITHHOLDING', 'Withholding Tax'),
        ('OTHER', 'Other'),
    ]

    # ── Jurisdiction Matching ─────────────────────────────────────────
    name = models.CharField(max_length=200,
        help_text='Descriptive name (e.g. "Côte d\'Ivoire Domestic VAT", "US-CA Sales Tax")')

    country_code = models.CharField(max_length=3, db_index=True,
        help_text='ISO 3166-1 alpha-2/3 country code this rule applies to')

    region_code = models.CharField(max_length=50, null=True, blank=True,
        help_text='State/province/region code for sub-national taxes (e.g. CA, ON, BW)')

    tax_type = models.CharField(max_length=20, choices=TAX_TYPE_CHOICES, default='VAT')

    # ── Tax Behavior ──────────────────────────────────────────────────
    rate = models.DecimalField(max_digits=7, decimal_places=4, default=Decimal('0.0000'),
        help_text='Standard tax rate for this jurisdiction (e.g. 0.18 for 18%)')

    place_of_supply_mode = models.CharField(
        max_length=20, choices=PLACE_OF_SUPPLY_MODES, default='ORIGIN',
        help_text='How to determine which jurisdiction\'s rate applies')

    reverse_charge_allowed = models.BooleanField(default=False,
        help_text='True if B2B cross-border reverse charge is available')

    zero_rate_export = models.BooleanField(default=True,
        help_text='True if exports to this jurisdiction are zero-rated')

    # ── Thresholds ────────────────────────────────────────────────────
    registration_threshold = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Revenue threshold requiring tax registration (marketplace nexus)')

    # ── Priority & Status ─────────────────────────────────────────────
    priority = models.IntegerField(default=100,
        help_text='Higher priority rules override lower ones for same jurisdiction')

    is_active = models.BooleanField(default=True)
    is_system_preset = models.BooleanField(default=False,
        help_text='True = seeded by system, not org-specific')

    # ── Audit ─────────────────────────────────────────────────────────
    effective_from = models.DateField(null=True, blank=True,
        help_text='Date this rule becomes effective')
    effective_to = models.DateField(null=True, blank=True,
        help_text='Date this rule expires (null = no expiry)')

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'tax_jurisdiction_rule'
        ordering = ['-priority', 'country_code', 'region_code']
        indexes = [
            models.Index(fields=['country_code', 'region_code', 'tax_type'],
                         name='tax_juris_country_region_idx'),
        ]

    def __str__(self):
        region = f"-{self.region_code}" if self.region_code else ""
        return f"{self.country_code}{region} {self.tax_type} {self.rate*100:.1f}%"
