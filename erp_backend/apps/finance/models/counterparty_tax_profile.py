"""
CounterpartyTaxProfile
======================
Defines WHAT A SUPPLIER OR CLIENT IS fiscally.

Applies to: Contact (supplier or client)
NOT for your organization — use OrgTaxPolicy for that.

Key fields:
- vat_registered  : do they charge VAT? (supplier) / are they VAT-registered? (client)
- reverse_charge  : foreign B2B inbound — autoliquidation (NOT for export)
- airsi_subject   : buying from them triggers AIRSI withholding

Export handling:
- Do NOT use reverse_charge for export.
- Export is handled by Order.is_export = True → VAT rate forced to 0.
"""
from django.db import models
from erp.models import TenantModel


# System-level preset names (referenced in code for seeding)
PRESET_ASSUJETTI        = 'Assujetti TVA'
PRESET_NON_ASSUJETTI    = 'Non-Assujetti'
PRESET_FOREIGN_B2B      = 'Foreign B2B (Reverse Charge)'
PRESET_AIRSI_SUBJECT    = 'AIRSI Subject'
PRESET_EXPORT_CLIENT    = 'Export Client'


class CounterpartyTaxProfile(TenantModel):
    """
    Fiscal identity of a counterparty (supplier or client contact).
    organization_id = NULL for system presets, set for org-specific profiles.
    """

    # ── Identity ──────────────────────────────────────────────────────
    name = models.CharField(max_length=150,
                            help_text='e.g. "Assujetti TVA", "Non-Assujetti", "Foreign B2B"')
    country_code = models.CharField(
        max_length=3, default='CI',
        help_text='ISO country code of the counterparty'
    )

    # ── VAT ───────────────────────────────────────────────────────────
    vat_registered = models.BooleanField(
        default=True,
        help_text=(
            'Supplier: do they charge VAT on their invoices? '
            'Client: are they VAT-registered (eligible for TVA Invoice)?'
        )
    )

    # ── Reverse Charge (foreign B2B inbound ONLY) ─────────────────────
    reverse_charge = models.BooleanField(
        default=False,
        help_text=(
            'True for foreign B2B suppliers only — triggers autoliquidation. '
            'NOT for export; use Order.is_export for that.'
        )
    )

    # ── AIRSI ─────────────────────────────────────────────────────────
    airsi_subject = models.BooleanField(
        default=False,
        help_text='Buying from this supplier triggers AIRSI withholding'
    )

    # ── Scope ─────────────────────────────────────────────────────────
    allowed_scopes = models.JSONField(
        default=list,
        help_text='Scopes allowed when transacting with this counterparty'
    )

    # ── Audit ─────────────────────────────────────────────────────────
    is_system_preset = models.BooleanField(
        default=False,
        help_text='True = created by system seed, shared across orgs'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'counterparty_tax_profile'
        ordering = ['name']

    def __str__(self):
        flags = []
        if self.vat_registered: flags.append('VAT')
        if self.reverse_charge:  flags.append('RC')
        if self.airsi_subject:   flags.append('AIRSI')
        return f"{self.name} [{', '.join(flags) or 'plain'}]"
