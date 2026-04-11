"""
EInvoiceStandard
================
SaaS-level (global, NOT tenant-scoped) entity defining e-invoicing standards.
Each standard specifies its required credentials, branding fields, and setup guide.
Country Tax Templates reference these standards; tenants inherit them.

Flow:
  1. SaaS admin creates/manages standards (ZATCA, UBL, Factur-X, etc.)
  2. SaaS admin assigns a standard to a CountryTaxTemplate
  3. Tenant inherits the standard → fills in credentials → activates
"""
from django.db import models


class EInvoiceStandard(models.Model):
    """
    Global (non-tenant) entity for e-invoicing standards.
    NOT a TenantModel — shared across all organizations.
    """

    # ── Identity ──────────────────────────────────────────────────────
    code = models.CharField(
        max_length=30, unique=True,
        help_text='Unique code (e.g. ZATCA, UBL_PEPPOL, FACTUR_X)')
    name = models.CharField(
        max_length=120,
        help_text='Display name (e.g. "ZATCA FATOORA (Saudi Arabia)")')
    description = models.TextField(
        blank=True, default='',
        help_text='When and why this standard is used')
    region = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Geographic region or country (e.g. "European Union", "Saudi Arabia")')

    # ── Technical Details ─────────────────────────────────────────────
    INVOICE_FORMAT_CHOICES = [
        ('XML', 'XML (UBL / CII)'),
        ('JSON', 'JSON'),
        ('PDF_A3', 'PDF/A-3 (Factur-X / ZUGFeRD)'),
        ('HYBRID', 'Hybrid (XML embedded in PDF)'),
    ]
    invoice_format = models.CharField(
        max_length=20, default='XML', choices=INVOICE_FORMAT_CHOICES,
        help_text='Primary document format for this standard')
    schema_version = models.CharField(
        max_length=30, blank=True, default='',
        help_text='Schema version (e.g. "UBL 2.1", "ZATCA Phase 2")')

    # ── Required Credentials ──────────────────────────────────────────
    # Dynamic form definition: what the TENANT must provide
    # JSON array of field defs:
    #   [{"key": "api_key", "label": "API Key", "type": "text",
    #     "required": true, "placeholder": "sk-live-...",
    #     "help": "Get from your portal"}, ...]
    # Supported types: text, url, email, file, image, textarea, password
    required_credentials = models.JSONField(
        default=list, blank=True,
        help_text='JSON array of credential field definitions tenants must fill')

    # ── Branding Customization ────────────────────────────────────────
    # Fields tenants can customize (logo, header, footer, etc.)
    # Same format as required_credentials
    branding_fields = models.JSONField(
        default=list, blank=True,
        help_text='JSON array of branding field definitions tenants can customize')

    # ── Setup Guide ──────────────────────────────────────────────────
    setup_guide = models.TextField(
        blank=True, default='',
        help_text='Step-by-step instructions for tenant onboarding (markdown)')
    portal_url = models.URLField(
        blank=True, default='',
        help_text='Official portal URL for registration')
    documentation_url = models.URLField(
        blank=True, default='',
        help_text='Link to official API/standard documentation')

    # ── Meta ──────────────────────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'einvoice_standard'
        ordering = ['name']
        verbose_name = 'E-Invoice Standard'
        verbose_name_plural = 'E-Invoice Standards'

    def __str__(self):
        return f"{self.code} — {self.name}"
