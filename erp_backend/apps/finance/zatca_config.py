"""
ZATCA Configuration Model
===========================
Per-organization ZATCA certificate management and API credentials.
Stores X.509 certificates, private keys, and onboarding state
for FATOORA Phase 2 compliance.
"""
from django.db import models
from erp.models import TenantModel


class ZATCAConfig(TenantModel):
    """
    Per-organization ZATCA configuration.

    Stores the cryptographic credentials needed for invoice signing
    and the ZATCA API interaction parameters.
    """
    # ── Tax Registration ─────────────────────────────────────────────
    vat_registration_number = models.CharField(
        max_length=15,
        help_text='Saudi VAT TRN (Tax Registration Number), 15 digits'
    )
    seller_name = models.CharField(
        max_length=255,
        help_text='Legal seller name as registered with ZATCA'
    )

    # ── Certificates & Keys ──────────────────────────────────────────
    certificate_pem = models.TextField(
        null=True, blank=True,
        help_text='X.509 compliance certificate (PEM format)'
    )
    private_key_pem = models.TextField(
        null=True, blank=True,
        help_text='ECDSA private key (PEM format, encrypted at rest)'
    )
    csr_request_id = models.CharField(
        max_length=255, null=True, blank=True,
        help_text='ZATCA onboarding CSR request ID'
    )
    compliance_certificate_pem = models.TextField(
        null=True, blank=True,
        help_text='Compliance certificate from ZATCA onboarding'
    )
    production_certificate_pem = models.TextField(
        null=True, blank=True,
        help_text='Production certificate from ZATCA onboarding'
    )

    # ── Environment ──────────────────────────────────────────────────
    is_sandbox = models.BooleanField(
        default=True,
        help_text='Use ZATCA sandbox API (True) or production (False)'
    )
    is_active = models.BooleanField(
        default=False,
        help_text='Whether ZATCA e-invoicing is enabled for this org'
    )

    # ── Hash Chain State ─────────────────────────────────────────────
    last_invoice_hash = models.CharField(
        max_length=64, default='0' * 64,
        help_text='SHA-256 hash of the last submitted invoice (chain anchor)'
    )
    invoice_counter = models.IntegerField(
        default=0,
        help_text='Sequential counter of ZATCA-submitted invoices'
    )

    # ── Audit ────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'zatca_config'
        verbose_name = 'ZATCA Configuration'
        verbose_name_plural = 'ZATCA Configurations'

    def __str__(self):
        env = 'Sandbox' if self.is_sandbox else 'Production'
        return f"ZATCA Config ({self.vat_registration_number}) [{env}]"
