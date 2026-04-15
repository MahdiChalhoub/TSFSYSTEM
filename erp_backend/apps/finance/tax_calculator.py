"""
Tax Calculator Service
=====================
Reusable tax calculation engine that respects OrgTaxPolicy configuration.
Extracts inline tax logic from POS/Purchase services into a standalone service.

Architecture (v2):
  - TaxEngineContext: Per-transaction context object. Built from OrgTaxPolicy
    (the authoritative source). Falls back to legacy companyType if no policy exists.
  - TaxCalculator: Pure math helpers + resolution utilities.
  - _SupplierProfile: Adapter for CounterpartyTaxProfile resolution from a Contact.

Usage:
    from apps.finance.tax_calculator import TaxCalculator, TaxEngineContext

    # Build context for a transaction
    ctx = TaxEngineContext.from_org(org, scope='OFFICIAL', is_export=False)
    # ctx.vat_active → True/False
    # ctx.vat_input_recoverability → Decimal('1.0')
    # ctx.custom_rules → [CustomTaxRule, ...]

    # Resolve product-level tax rate (respects TaxRateCategory override)
    rate = TaxCalculator.resolve_product_rate(product, ctx)

    # Calculate tax from a price
    result = TaxCalculator.calculate_tax(amount=1000, rate=Decimal('0.18'), mode='TTC')
    # result = {'ht': 847.46, 'tax': 152.54, 'ttc': 1000.00}
"""
from decimal import Decimal, ROUND_HALF_UP
import logging

logger = logging.getLogger(__name__)

TWOPLACES = Decimal('0.01')


# ══════════════════════════════════════════════════════════════════════
# TaxEngineContext
# ══════════════════════════════════════════════════════════════════════

class TaxEngineContext:
    """
    Per-transaction tax context. Built once per checkout/purchase and reused
    across all lines to ensure consistent behavior.

    Primary source: OrgTaxPolicy (is_default=True for the organization).
    Fallback:       Legacy companyType from ConfigurationService (backward compat
                    for orgs that don't have an OrgTaxPolicy yet).

    Key attributes:
        scope (str):                    'OFFICIAL' | 'INTERNAL'
        vat_active (bool):              True if VAT should be charged/split on this txn
        vat_input_recoverability (Decimal): 0.0–1.0 portion of input VAT that is refundable
        airsi_treatment (str):          'CAPITALIZE' | 'RECOVER' | 'EXPENSE'
        default_rate (Decimal | None):  Org-level default VAT rate (from policy metadata)
        is_export (bool):               Exports are zero-rated
        custom_rules (list):            Active CustomTaxRule objects for the org
        _policy (OrgTaxPolicy | None):  Raw policy object for callers that need more fields
    """

    def __init__(
        self,
        scope='OFFICIAL',
        vat_active=True,
        vat_input_recoverability=Decimal('0'),
        airsi_treatment='CAPITALIZE',
        default_rate=None,
        is_export=False,
        custom_rules=None,
        policy=None,
    ):
        self.scope = scope
        self.vat_active = vat_active
        self.vat_input_recoverability = Decimal(str(vat_input_recoverability))
        self.airsi_treatment = airsi_treatment
        self.default_rate = default_rate
        self.is_export = is_export
        self.custom_rules = custom_rules or []
        self._policy = policy

    # ── Scope mode helpers ───────────────────────────────────────────

    @property
    def is_official(self):
        return self.scope == 'OFFICIAL'

    @property
    def is_internal(self):
        return self.scope == 'INTERNAL'

    @property
    def effective_tax_mode(self):
        """Return 'HT' if VAT is tracked separately, 'TTC' if costed-in."""
        if self._policy:
            mode = getattr(self._policy, 'internal_cost_mode', None)
            if self.scope == 'INTERNAL' and mode:
                if mode == 'TTC_ALWAYS':
                    return 'TTC'
                if mode == 'SAME_AS_OFFICIAL':
                    # Fall through to policy vat_output_enabled
                    pass
            if getattr(self._policy, 'vat_output_enabled', False):
                return 'HT'
        return 'TTC'

    # ── Factory ──────────────────────────────────────────────────────

    @classmethod
    def from_org(cls, organization, scope='OFFICIAL', is_export=False):
        """
        Build a TaxEngineContext for an organization + scope combination.

        Resolution order:
            1. OrgTaxPolicy (is_default=True) → authoritative
            2. Legacy companyType from ConfigurationService → backward compat
            3. Safe defaults (no VAT, no recovery)
        """
        try:
            from apps.finance.models import OrgTaxPolicy, CustomTaxRule

            policy = OrgTaxPolicy.objects.filter(
                organization=organization, is_default=True
            ).first()

            if policy:
                # ── OrgTaxPolicy path (new, authoritative) ──────────────────
                vat_active = (scope == 'OFFICIAL') and policy.vat_output_enabled

                # exports are always zero-rated
                if is_export:
                    vat_active = False

                # Load active custom rules
                custom_rules = list(
                    CustomTaxRule.objects.filter(
                        organization=organization, is_active=True
                    ).order_by('calculation_order')
                )

                return cls(
                    scope=scope,
                    vat_active=vat_active,
                    vat_input_recoverability=policy.vat_input_recoverability,
                    airsi_treatment=policy.airsi_treatment,
                    default_rate=None,  # per-product rate resolution via resolve_product_rate()
                    is_export=is_export,
                    custom_rules=custom_rules,
                    policy=policy,
                )

        except Exception as exc:
            logger.warning(
                "[TaxEngine] OrgTaxPolicy resolution failed for org %s: %s",
                getattr(organization, 'id', '?'), exc
            )

        # ── Legacy companyType fallback ──────────────────────────────────────
        return cls._from_legacy(organization, scope=scope, is_export=is_export)

    @classmethod
    def _from_legacy(cls, organization, scope='OFFICIAL', is_export=False):
        """
        Backward-compatible context builder using companyType settings.
        Used when no OrgTaxPolicy exists for the organization.
        """
        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(organization)
            company_type = settings.get('companyType', 'REGULAR')
        except Exception:
            company_type = 'REGULAR'

        LEGACY_MAP = {
            'REAL':    {'vat_output': True,  'recoverability': Decimal('1.0'), 'airsi': 'RECOVER'},
            'MIXED':   {'vat_output': True,  'recoverability': Decimal('0.0'), 'airsi': 'CAPITALIZE'},
            'REGULAR': {'vat_output': False, 'recoverability': Decimal('0.0'), 'airsi': 'CAPITALIZE'},
            'MICRO':   {'vat_output': False, 'recoverability': Decimal('0.0'), 'airsi': 'EXPENSE'},
        }
        cfg = LEGACY_MAP.get(company_type, LEGACY_MAP['REGULAR'])

        vat_active = (scope == 'OFFICIAL') and cfg['vat_output']
        if is_export:
            vat_active = False

        custom_rules = []
        try:
            from apps.finance.models import CustomTaxRule
            custom_rules = list(
                CustomTaxRule.objects.filter(
                    organization=organization, is_active=True
                ).order_by('calculation_order')
            )
        except Exception:
            pass

        logger.debug(
            "[TaxEngine] Using legacy companyType='%s' for org %s (no OrgTaxPolicy found)",
            company_type, getattr(organization, 'id', '?')
        )

        return cls(
            scope=scope,
            vat_active=vat_active,
            vat_input_recoverability=cfg['recoverability'],
            airsi_treatment=cfg['airsi'],
            is_export=is_export,
            custom_rules=custom_rules,
            policy=None,
        )

    def __repr__(self):
        return (
            f"TaxEngineContext(scope={self.scope!r}, vat_active={self.vat_active}, "
            f"recoverability={self.vat_input_recoverability}, "
            f"airsi={self.airsi_treatment!r}, policy={'set' if self._policy else 'legacy'})"
        )


# ══════════════════════════════════════════════════════════════════════
# _SupplierProfile
# ══════════════════════════════════════════════════════════════════════

class _SupplierProfile:
    """
    Lightweight adapter that resolves a CounterpartyTaxProfile from a Contact.
    Used by POSService / PurchaseService to determine buyer/seller VAT registration
    without needing to know the internal model structure.

    Usage:
        profile = _SupplierProfile.from_contact(contact)
        profile.vat_registered → bool
        profile.reverse_charge → bool
        profile.airsi_subject  → bool
    """

    def __init__(
        self,
        vat_registered=False,
        reverse_charge=False,
        airsi_subject=False,
        profile_name='',
        profile_obj=None,
    ):
        self.vat_registered = vat_registered
        self.reverse_charge = reverse_charge
        self.airsi_subject = airsi_subject
        self.profile_name = profile_name
        self._profile_obj = profile_obj

    @classmethod
    def from_contact(cls, contact):
        """
        Resolve the tax profile for a contact, checking CounterpartyTaxProfile FK first,
        then falling back to direct fields on the Contact model.
        """
        if contact is None:
            return cls()

        # 1. Check FK to CounterpartyTaxProfile
        profile_fk = getattr(contact, 'tax_profile', None) or getattr(contact, 'counterparty_tax_profile', None)
        if profile_fk:
            try:
                return cls(
                    vat_registered=getattr(profile_fk, 'vat_registered', False),
                    reverse_charge=getattr(profile_fk, 'reverse_charge', False),
                    airsi_subject=getattr(profile_fk, 'airsi_subject', False),
                    profile_name=getattr(profile_fk, 'name', ''),
                    profile_obj=profile_fk,
                )
            except Exception:
                pass

        # 2. Try org-linked CounterpartyTaxProfile lookup
        try:
            from apps.finance.models import CounterpartyTaxProfile
            profile = CounterpartyTaxProfile.objects.filter(
                organization=contact.organization,
                contacts=contact,
            ).first()
            if profile:
                return cls(
                    vat_registered=profile.vat_registered,
                    reverse_charge=profile.reverse_charge,
                    airsi_subject=getattr(profile, 'airsi_subject', False),
                    profile_name=profile.name,
                    profile_obj=profile,
                )
        except Exception:
            pass

        # 3. Fall back to direct Contact fields
        return cls(
            vat_registered=getattr(contact, 'vat_registered', False)
                           or getattr(contact, 'is_vat_registered', False),
            reverse_charge=getattr(contact, 'reverse_charge', False),
            airsi_subject=getattr(contact, 'is_airsi_subject', False)
                          or getattr(contact, 'airsi_subject', False),
        )

    def __repr__(self):
        return (
            f"_SupplierProfile(vat={self.vat_registered}, "
            f"reverse_charge={self.reverse_charge}, airsi={self.airsi_subject})"
        )


# ══════════════════════════════════════════════════════════════════════
# TaxCalculator
# ══════════════════════════════════════════════════════════════════════

class TaxCalculator:
    """
    Centralized tax calculation engine.

    Resolution hierarchy for tax mode:
    1. OrgTaxPolicy (via TaxEngineContext)
    2. Legacy companyType (backward compat)
    3. Default: TTC
    """

    # ── Tax Mode Resolution ──────────────────────────────────────────

    @staticmethod
    def get_tax_mode(organization) -> str:
        """
        Resolve the tax mode for an organization.
        Returns 'HT' or 'TTC'.

        Primary: reads OrgTaxPolicy.internal_cost_mode
        Fallback: legacy companyType mapping
        """
        try:
            from apps.finance.models import OrgTaxPolicy
            policy = OrgTaxPolicy.objects.filter(
                organization=organization, is_default=True
            ).first()
            if policy:
                mode = getattr(policy, 'internal_cost_mode', 'TTC_ALWAYS')
                if mode == 'SAME_AS_OFFICIAL':
                    return 'HT' if policy.vat_output_enabled else 'TTC'
                return 'TTC'  # TTC_ALWAYS is the safest default
        except Exception:
            pass

        # Legacy fallback
        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(organization)
            company_type = settings.get('companyType', 'REGULAR')
            works_in_ttc = settings.get('worksInTTC', True)

            if company_type == 'REAL':
                return 'HT'
            elif company_type in ('REGULAR', 'MICRO'):
                return 'TTC'
            elif company_type in ('MIXED', 'CUSTOM'):
                return 'TTC' if works_in_ttc else 'HT'
        except Exception:
            pass

        return 'TTC'

    @staticmethod
    def can_reclaim_vat(organization) -> bool:
        """
        Whether this organization can reclaim input VAT on purchases.
        Primary: OrgTaxPolicy.vat_input_recoverability > 0
        Fallback: legacy companyType
        """
        try:
            from apps.finance.models import OrgTaxPolicy
            policy = OrgTaxPolicy.objects.filter(
                organization=organization, is_default=True
            ).first()
            if policy:
                return policy.vat_input_recoverability > Decimal('0')
        except Exception:
            pass

        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(organization)
            company_type = settings.get('companyType', 'REGULAR')
            return company_type == 'REAL'
        except Exception:
            return False

    @staticmethod
    def get_airsi_treatment(organization) -> str:
        """
        How AIRSI withholding tax is treated for this organization.
        Returns: 'CAPITALIZE' | 'RECOVER' | 'EXPENSE'
        Primary: OrgTaxPolicy.airsi_treatment
        Fallback: legacy companyType
        """
        try:
            from apps.finance.models import OrgTaxPolicy
            policy = OrgTaxPolicy.objects.filter(
                organization=organization, is_default=True
            ).first()
            if policy:
                return policy.airsi_treatment
        except Exception:
            pass

        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(organization)
            company_type = settings.get('companyType', 'REGULAR')
            if company_type == 'REAL':
                return 'RECOVER'
            if company_type == 'MICRO':
                return 'EXPENSE'
        except Exception:
            pass

        return 'CAPITALIZE'

    # ── Invoice Type Resolution ───────────────────────────────────────

    @staticmethod
    def resolve_invoice_type(ctx: TaxEngineContext, client_vat_registered: bool = False) -> str:
        """
        Determine the invoice type for an order based on engine context.

        VAT org + VAT client → INVOICE_HT (formal B2B invoice with tax split)
        VAT org + non-VAT client → INVOICE_TTC (simplified consumer invoice)
        Non-VAT org → RECEIPT (simple receipts, no formal VAT invoice)
        """
        if not ctx.vat_active:
            return 'RECEIPT'
        if client_vat_registered:
            return 'INVOICE_HT'
        return 'INVOICE_TTC'

    # ── Product Rate Resolution ───────────────────────────────────────

    @staticmethod
    def resolve_product_rate(product, ctx: TaxEngineContext) -> Decimal:
        """
        Resolve the effective VAT rate for a product in a given engine context.

        Resolution order:
          1. product.tax_rate_category → TaxRateCategory.rate (per-product override)
          2. ctx.default_rate (org-level default from policy)
          3. product.tva_rate (legacy product-level rate)
          4. Decimal('0') (zero-rated fallback)

        If ctx.is_export is True, always returns Decimal('0').
        """
        if ctx.is_export:
            return Decimal('0')

        # 1. TaxRateCategory override (Priority 5 feature)
        tax_cat_id = getattr(product, 'tax_rate_category_id', None)
        if tax_cat_id:
            try:
                from apps.finance.models import TaxRateCategory
                cat = TaxRateCategory.objects.get(id=tax_cat_id)
                return Decimal(str(cat.rate))
            except Exception:
                pass

        # 2. Engine context default rate
        if ctx.default_rate is not None:
            return Decimal(str(ctx.default_rate))

        # 3. Product tva_rate (legacy, already stored as decimal fraction e.g. 0.18)
        tva = getattr(product, 'tva_rate', None)
        if tva is not None:
            return Decimal(str(tva))

        return Decimal('0')

    # ── Core Tax Math ────────────────────────────────────────────────

    @staticmethod
    def calculate_tax(amount: Decimal, rate: Decimal, mode: str = 'TTC') -> dict:
        """
        Calculate tax breakdown from a given amount.

        Args:
            amount: The input amount (either HT or TTC depending on mode)
            rate: Tax rate as a decimal (e.g., Decimal('0.18') for 18%)
            mode: 'HT' = amount is pre-tax; 'TTC' = amount includes tax

        Returns:
            dict with keys: ht, tax, ttc (all Decimal, rounded to 2 places)
        """
        amount = Decimal(str(amount))
        rate = Decimal(str(rate))

        if mode == 'HT':
            ht = amount
            tax = (ht * rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            ttc = ht + tax
        else:  # TTC
            ttc = amount
            ht = (ttc / (Decimal('1') + rate)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            tax = ttc - ht
        return {'ht': ht, 'tax': tax, 'ttc': ttc}

    @staticmethod
    def calculate_line_tax(
        quantity: Decimal,
        unit_price: Decimal,
        tax_rate: Decimal,
        mode: str = 'TTC',
        rounding: str = 'per_line'
    ) -> dict:
        """
        Calculate tax for a single order line.

        Args:
            quantity: Number of units
            unit_price: Price per unit (HT or TTC depending on mode)
            tax_rate: Tax rate as decimal (e.g., 0.18)
            mode: 'HT' or 'TTC'
            rounding: 'per_line' (round each line) or 'on_total' (accumulate raw)

        Returns:
            dict: unit_ht, unit_ttc, line_ht, line_tax, line_ttc
        """
        quantity = Decimal(str(quantity))
        unit_price = Decimal(str(unit_price))
        tax_rate = Decimal(str(tax_rate))

        unit_result = TaxCalculator.calculate_tax(unit_price, tax_rate, mode)

        if rounding == 'per_line':
            line_ht = (unit_result['ht'] * quantity).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            line_tax = (unit_result['tax'] * quantity).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            line_ttc = line_ht + line_tax
        else:
            line_ht = unit_result['ht'] * quantity
            line_tax = unit_result['tax'] * quantity
            line_ttc = line_ht + line_tax

        return {
            'unit_ht': unit_result['ht'],
            'unit_ttc': unit_result['ttc'],
            'line_ht': line_ht,
            'line_tax': line_tax,
            'line_ttc': line_ttc,
        }

    @staticmethod
    def calculate_order_tax(lines: list, mode: str = 'TTC', rounding: str = 'per_line') -> dict:
        """
        Calculate aggregate tax for multiple order lines.

        Args:
            lines: list of dicts, each with keys: quantity, unit_price, tax_rate
            mode: 'HT' or 'TTC'
            rounding: 'per_line' or 'on_total'

        Returns:
            dict: total_ht, total_tax, total_ttc, line_results (list)
        """
        total_ht = Decimal('0')
        total_tax = Decimal('0')
        total_ttc = Decimal('0')
        line_results = []

        for line in lines:
            result = TaxCalculator.calculate_line_tax(
                quantity=line['quantity'],
                unit_price=line['unit_price'],
                tax_rate=line['tax_rate'],
                mode=mode,
                rounding=rounding
            )
            total_ht += result['line_ht']
            total_tax += result['line_tax']
            total_ttc += result['line_ttc']
            line_results.append(result)

        if rounding == 'on_total':
            total_ht = total_ht.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            total_tax = total_tax.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            total_ttc = total_ht + total_tax

        return {
            'total_ht': total_ht,
            'total_tax': total_tax,
            'total_ttc': total_ttc,
            'line_results': line_results,
        }

    # ── Effective Cost Resolution ────────────────────────────────────

    @staticmethod
    def resolve_effective_cost(
        unit_cost_ht: Decimal,
        unit_cost_ttc: Decimal,
        organization=None,
        pricing_cost_basis: str = 'AUTO',
        vat_recoverable: bool = False
    ) -> Decimal:
        """
        Determine the effective cost for inventory valuation.

        Logic mirrors PurchaseService.quick_purchase():
        - FORCE_HT  → always use HT
        - FORCE_TTC → always use TTC
        - AUTO       → HT if VAT recoverable, else TTC
        """
        unit_cost_ht = Decimal(str(unit_cost_ht))
        unit_cost_ttc = Decimal(str(unit_cost_ttc))

        if pricing_cost_basis == 'FORCE_HT':
            return unit_cost_ht
        elif pricing_cost_basis == 'FORCE_TTC':
            return unit_cost_ttc
        else:  # AUTO
            return unit_cost_ht if vat_recoverable else unit_cost_ttc
