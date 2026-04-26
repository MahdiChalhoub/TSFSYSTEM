"""
Reference Master Data Models
=============================
Global SaaS-level reference tables for countries and currencies,
plus organization-scoped activation/selection tables.

Architecture:
  - Country, Currency, CountryCurrencyMap → SaaS-level (models.Model)
  - OrgCountry, OrgCurrency → Tenant-scoped (AuditLogMixin + TenantOwnedModel)

Table naming: ref_ prefix for global, ref_org_ for tenant-scoped.
"""
from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


# =============================================================================
# GLOBAL SAAS REFERENCE TABLES (Not tenant-scoped)
# =============================================================================

class Currency(models.Model):
    """
    Global ISO 4217 currency master table.
    Owned by the SaaS platform — organizations select from this list.

    Tenant Isolation: N/A (global reference data)
    Audit Logging: N/A (platform-managed, immutable reference)
    """
    code = models.CharField(
        max_length=3, unique=True, db_index=True,
        help_text='ISO 4217 alpha code (e.g., USD, EUR, XOF)'
    )
    numeric_code = models.CharField(
        max_length=3, blank=True, default='',
        help_text='ISO 4217 numeric code (e.g., 840, 978, 952)'
    )
    name = models.CharField(
        max_length=255,
        help_text='Currency name (e.g., US Dollar, Euro)'
    )
    symbol = models.CharField(
        max_length=10, blank=True, default='',
        help_text='Currency symbol (e.g., $, €, £)'
    )
    minor_unit = models.PositiveSmallIntegerField(
        default=2,
        help_text='Number of decimal places (e.g., 2 for USD, 0 for JPY, 3 for BHD)'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ref_currencies'
        ordering = ['code']
        verbose_name = 'Currency'
        verbose_name_plural = 'Currencies'

    def __str__(self):
        return f"{self.code} — {self.name}"


class Country(models.Model):
    """
    Global ISO 3166-1 country master table.
    Owned by the SaaS platform — organizations select from this list.

    Tenant Isolation: N/A (global reference data)
    Audit Logging: N/A (platform-managed, immutable reference)
    """
    iso2 = models.CharField(
        max_length=2, unique=True, db_index=True,
        help_text='ISO 3166-1 alpha-2 code (e.g., US, FR, LB)'
    )
    iso3 = models.CharField(
        max_length=3, unique=True, db_index=True,
        help_text='ISO 3166-1 alpha-3 code (e.g., USA, FRA, LBN)'
    )
    numeric_code = models.CharField(
        max_length=3, blank=True, default='',
        help_text='ISO 3166-1 numeric code (e.g., 840, 250, 422)'
    )
    name = models.CharField(
        max_length=255,
        help_text='Common English name'
    )
    official_name = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Official state name (e.g., Republic of Lebanon)'
    )
    phone_code = models.CharField(
        max_length=20, blank=True, default='',
        help_text='International dialing code (e.g., +1, +33, +961)'
    )
    region = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Geographic region (e.g., Americas, Europe, Asia)'
    )
    subregion = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Geographic subregion (e.g., Northern America, Western Europe)'
    )
    default_currency = models.ForeignKey(
        Currency, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='default_for_countries',
        help_text='Primary/default currency for this country'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ref_countries'
        ordering = ['name']
        verbose_name = 'Country'
        verbose_name_plural = 'Countries'

    def __str__(self):
        return f"{self.name} ({self.iso2})"


class CountryCurrencyMap(models.Model):
    """
    Many-to-many mapping between countries and currencies.
    Allows countries with multiple legal tender currencies.

    Tenant Isolation: N/A (global reference data)
    Audit Logging: N/A (platform-managed, immutable reference)
    """
    country = models.ForeignKey(
        Country, on_delete=models.CASCADE,
        related_name='currency_mappings'
    )
    currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE,
        related_name='country_mappings'
    )
    is_primary = models.BooleanField(
        default=False,
        help_text='Primary currency for this country'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ref_country_currency_map'
        unique_together = ('country', 'currency')
        ordering = ['country__name', '-is_primary']

    def __str__(self):
        primary = ' (Primary)' if self.is_primary else ''
        return f"{self.country.iso2} → {self.currency.code}{primary}"


# =============================================================================
# ORGANIZATION-SCOPED ACTIVATION TABLES
# =============================================================================

class OrgCountry(AuditLogMixin, TenantOwnedModel):
    """
    Organization's enabled countries — selected from the global master list.

    Tenant Isolation: ✅ Automatic via TenantOwnedModel
    Audit Logging: ✅ Automatic via AuditLogMixin
    """
    country = models.ForeignKey(
        Country, on_delete=models.CASCADE,
        related_name='org_activations'
    )
    is_enabled = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False,
        help_text='Default/base country for this organization'
    )
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'ref_org_countries'
        unique_together = ('organization', 'country')
        ordering = ['-is_default', 'display_order', 'country__name']
        indexes = [
            models.Index(fields=['organization', 'is_enabled']),
        ]

    def __str__(self):
        default_tag = ' [DEFAULT]' if self.is_default else ''
        return f"{self.country.iso2}{default_tag}"

    def save(self, *args, **kwargs):
        # Enforce single-default rule
        if self.is_default:
            OrgCountry.all_objects.filter(
                organization=self.organization,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class OrgCurrency(AuditLogMixin, TenantOwnedModel):
    """
    Organization's enabled currencies — selected from the global master list.

    Tenant Isolation: ✅ Automatic via TenantOwnedModel
    Audit Logging: ✅ Automatic via AuditLogMixin
    """
    EXCHANGE_RATE_SOURCES = [
        ('MANUAL', 'Manual Entry'),
        ('ECB', 'European Central Bank'),
        ('BCEAO', 'BCEAO (West Africa)'),
        ('IMPORT', 'Imported'),
        ('API', 'External API'),
    ]

    currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE,
        related_name='org_activations'
    )
    is_enabled = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False,
        help_text='Base/functional currency for this organization'
    )
    display_order = models.PositiveIntegerField(default=0)
    exchange_rate_source = models.CharField(
        max_length=50, blank=True, default='MANUAL',
        choices=EXCHANGE_RATE_SOURCES,
        help_text='Default exchange rate source for this currency'
    )
    is_reporting_currency = models.BooleanField(
        default=False,
        help_text='Used for consolidated reporting'
    )
    is_transaction_currency = models.BooleanField(
        default=True,
        help_text='Allowed in transactional documents (invoices, POs, payments)'
    )

    # Per-country activation matrix.
    #
    # Empty list (default) = currency is available in EVERY enabled OrgCountry
    # for this org. The base currency (is_default=True) ALWAYS behaves as if
    # this list is empty, regardless of value (you cannot scope-restrict the
    # base — it's the books' anchor).
    #
    # Populated list = restrict this currency to those Country (global ref)
    # FK ids only. Useful for "EUR is available for our France entity, not
    # our US entity" scenarios.
    enabled_in_country_ids = models.JSONField(
        default=list, blank=True,
        help_text='List of Country FK ids this currency is enabled in. Empty = all enabled countries.',
    )

    class Meta:
        db_table = 'ref_org_currencies'
        unique_together = ('organization', 'currency')
        ordering = ['-is_default', 'display_order', 'currency__code']
        indexes = [
            models.Index(fields=['organization', 'is_enabled']),
        ]

    def __str__(self):
        default_tag = ' [BASE]' if self.is_default else ''
        return f"{self.currency.code}{default_tag}"

    def save(self, *args, **kwargs):
        # Enforce single-default rule
        if self.is_default:
            OrgCurrency.all_objects.filter(
                organization=self.organization,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class SourcingCountry(AuditLogMixin, TenantOwnedModel):
    """
    Countries from which the organization sources / imports products.
    Separate from OrgCountry (operational countries for branches/sites).

    Used for:
      - Product 'Country of Origin' selection
      - Brand origin tracking
      - Customs / import documentation
      - Supplier geography analytics

    Tenant Isolation: ✅ Automatic via TenantOwnedModel
    Audit Logging: ✅ Automatic via AuditLogMixin
    """
    country = models.ForeignKey(
        Country, on_delete=models.CASCADE,
        related_name='sourcing_activations'
    )
    is_enabled = models.BooleanField(default=True)
    notes = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Optional notes (e.g., "Main food import hub")'
    )
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'ref_sourcing_countries'
        unique_together = ('organization', 'country')
        ordering = ['display_order', 'country__name']
        indexes = [
            models.Index(fields=['organization', 'is_enabled']),
        ]

    def __str__(self):
        return f"{self.country.iso2} (Sourcing)"


class City(models.Model):
    """
    Global reference table of cities/states/regions, linked to Country.
    Owned by the SaaS platform — organizations filter by their enabled countries.

    Tenant Isolation: N/A (global reference data, filtered by org countries at query time)
    Audit Logging: N/A (platform-managed reference data)
    """
    country = models.ForeignKey(
        Country, on_delete=models.CASCADE,
        related_name='cities',
        help_text='The country this city belongs to'
    )
    name = models.CharField(
        max_length=255,
        help_text='City name (e.g., Beirut, Abidjan, Paris)'
    )
    state_province = models.CharField(
        max_length=255, blank=True, default='',
        help_text='State/Province/Region (e.g., Mount Lebanon, Île-de-France)'
    )
    is_capital = models.BooleanField(
        default=False,
        help_text='Whether this is the country capital'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ref_cities'
        ordering = ['-is_capital', 'name']
        unique_together = ('country', 'name')
        verbose_name = 'City'
        verbose_name_plural = 'Cities'
        indexes = [
            models.Index(fields=['country', 'is_active']),
        ]

    def __str__(self):
        state = f', {self.state_province}' if self.state_province else ''
        return f"{self.name}{state} ({self.country.iso2})"

