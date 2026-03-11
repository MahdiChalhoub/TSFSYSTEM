"""
Tax Calculator Service
======================
Reusable tax calculation engine that respects organization's OrgTaxPolicy
and counterparty's CounterpartyTaxProfile.

Scope Guard Rule (enforced at top of every engine call):
    vat_active = (scope == "OFFICIAL") and org_policy.vat_output_enabled

No VAT tax lines are created if vat_active is False.
Reverse charge only triggers when vat_active is True AND supplier.reverse_charge is True.

Usage:
    from apps.finance.tax_calculator import TaxCalculator, TaxEngineContext

    ctx = TaxEngineContext.from_org(organization, scope='OFFICIAL')
    result = TaxCalculator.calculate_purchase(
        base_ht=Decimal('1000'),
        vat_rate=Decimal('0.18'),
        ctx=ctx,
        supplier_profile=supplier.tax_profile,
    )
"""
from decimal import Decimal, ROUND_HALF_UP
import logging

logger = logging.getLogger(__name__)

TWOPLACES = Decimal('0.01')


# ── Tax Engine Context ────────────────────────────────────────────────────────

class TaxEngineContext:
    """
    Resolved engine context for a single transaction.
    Built once per request — not a model, just a data container.
    """

    def __init__(
        self,
        scope: str = 'OFFICIAL',
        vat_output_enabled: bool = True,
        vat_input_recoverability: Decimal = Decimal('1.000'),
        airsi_treatment: str = 'CAPITALIZE',
        purchase_tax_rate: Decimal = Decimal('0.0000'),
        purchase_tax_mode: str = 'CAPITALIZE',
        internal_cost_mode: str = 'TTC_ALWAYS',
        internal_sales_vat_mode: str = 'NONE',
        is_export: bool = False,
        custom_rules: list = None,
    ):
        self.scope = scope
        self.is_export = is_export
        self.internal_cost_mode = internal_cost_mode
        self.internal_sales_vat_mode = internal_sales_vat_mode
        self.custom_rules = custom_rules or []

        # ── SCOPE GUARD (evaluated once at construction) ──────────────
        # VAT is only active when: scope is OFFICIAL AND org charges VAT on official sales
        self.vat_active = (scope == 'OFFICIAL') and vat_output_enabled

        # Export forces VAT to zero even if vat_active is True
        self.effective_vat_rate_override = Decimal('0') if is_export else None

        self.vat_input_recoverability = vat_input_recoverability
        self.airsi_treatment = airsi_treatment
        self.purchase_tax_rate = purchase_tax_rate
        self.purchase_tax_mode = purchase_tax_mode

    @classmethod
    def from_org(cls, organization, scope: str = 'OFFICIAL', is_export: bool = False):
        """
        Build context from an organization's default OrgTaxPolicy.
        Falls back to safe defaults if no policy is configured.
        """
        try:
            from apps.finance.models import OrgTaxPolicy, CustomTaxRule
            from erp.services import ConfigurationService

            policy = OrgTaxPolicy.objects.filter(
                organization=organization, is_default=True
            ).first()

            if policy:
                # ── Scope-Aware Recoverability Resolution ──
                # If the treatment for the current scope is CAPITALIZE or EXPENSE,
                # then VAT is NOT recovered from the state (recoverability = 0).
                # If RECOVERABLE, we use the policy's defined ratio.
                treatment = policy.official_vat_treatment if scope == 'OFFICIAL' else policy.internal_vat_treatment
                
                recoverability = policy.vat_input_recoverability
                if treatment in ('CAPITALIZE', 'EXPENSE'):
                    recoverability = Decimal('0.000')

                return cls(
                    scope=scope,
                    is_export=is_export,
                    vat_output_enabled=policy.vat_output_enabled,
                    vat_input_recoverability=recoverability,
                    airsi_treatment=policy.airsi_treatment,
                    purchase_tax_rate=policy.purchase_tax_rate,
                    purchase_tax_mode=policy.purchase_tax_mode,
                    internal_cost_mode=policy.internal_cost_mode,
                    internal_sales_vat_mode=policy.internal_sales_vat_mode,
                    custom_rules=list(CustomTaxRule.objects.filter(
                        organization=organization, is_active=True
                    )),
                )
        except Exception as e:
            logger.warning(f'TaxEngineContext: could not load OrgTaxPolicy — {e}')

        # Legacy fallback: read from old companyType settings
        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(organization)
            company_type = settings.get('companyType', 'REGULAR')

            vat_output = company_type in ('REAL', 'MIXED', 'REGULAR')
            # REAL = full VAT registrant (can recover all input VAT)
            # MIXED = pays VAT but cannot recover it → capitalizes into inventory cost
            # REGULAR / others = TTC purchases, no VAT recovery
            vat_recoverability = Decimal('1.000') if company_type == 'REAL' else Decimal('0.000')
            if company_type == 'REGULAR':
                vat_recoverability = Decimal('0.000')
            # MIXED: vat_recoverability stays 0 — VAT is a cost, not recoverable

            airsi_map = {'REAL': 'RECOVER', 'MICRO': 'EXPENSE'}
            airsi_treatment = airsi_map.get(company_type, 'CAPITALIZE')

            return cls(
                scope=scope,
                is_export=is_export,
                vat_output_enabled=vat_output,
                vat_input_recoverability=vat_recoverability,
                airsi_treatment=airsi_treatment,
            )
        except Exception as e:
            logger.warning(f'TaxEngineContext: legacy fallback also failed — {e}. Using bare defaults.')

        return cls(scope=scope, is_export=is_export)

    def get_effective_vat_rate(self, nominal_rate: Decimal) -> Decimal:
        """Return the VAT rate to use — 0 if export, nominal otherwise."""
        if self.effective_vat_rate_override is not None:
            return self.effective_vat_rate_override
        return nominal_rate

    def get_vat_cost_impact_ratio(self) -> Decimal:
        """Portion of input VAT that adds to inventory cost."""
        return Decimal('1.000') - self.vat_input_recoverability


# ── Supplier Profile Proxy ────────────────────────────────────────────────────

class _SupplierProfile:
    """Lightweight proxy to normalize counterparty tax profile access."""

    def __init__(self, vat_registered=True, reverse_charge=False, airsi_subject=False):
        self.vat_registered = vat_registered
        self.reverse_charge = reverse_charge
        self.airsi_subject = airsi_subject

    @classmethod
    def from_contact(cls, contact):
        """Load from a Contact that has a CounterpartyTaxProfile."""
        if contact is None:
            return cls()
        try:
            from apps.finance.models import CounterpartyTaxProfile
            if contact.tax_profile_id:
                p = CounterpartyTaxProfile.objects.get(id=contact.tax_profile_id)
                return cls(
                    vat_registered=p.vat_registered,
                    reverse_charge=p.reverse_charge,
                    airsi_subject=p.airsi_subject,
                )
        except Exception:
            pass

        # Legacy fallback: read from supplier_vat_regime
        regime = getattr(contact, 'supplier_vat_regime', 'ASSUJETTI') or 'ASSUJETTI'
        return cls(
            vat_registered=(regime != 'NON_ASSUJETTI'),
            reverse_charge=(regime == 'FOREIGN'),
            airsi_subject=getattr(contact, 'is_airsi_subject', False),
        )


class _ClientProfile:
    """Lightweight proxy for client tax profile."""

    def __init__(self, vat_registered=True):
        self.vat_registered = vat_registered

    @classmethod
    def from_contact(cls, contact):
        if contact is None:
            return cls(vat_registered=False)
        try:
            from apps.finance.models import CounterpartyTaxProfile
            if contact.tax_profile_id:
                p = CounterpartyTaxProfile.objects.get(id=contact.tax_profile_id)
                return cls(vat_registered=p.vat_registered)
        except Exception:
            pass

        # Legacy fallback: client_type B2B = vat_registered
        client_type = getattr(contact, 'client_type', 'UNKNOWN') or 'UNKNOWN'
        return cls(vat_registered=(client_type == 'B2B'))


# ── Core Tax Math ─────────────────────────────────────────────────────────────

class TaxCalculator:
    """
    Centralized tax calculation engine.

    All methods respect the TaxEngineContext scope guard.
    VAT is never computed or posted when ctx.vat_active is False.
    """

    # ── Legacy compatibility methods (still used by existing services) ─

    @staticmethod
    def get_tax_mode(organization) -> str:
        """Resolve HT or TTC for an organization. Kept for backward compat."""
        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(organization)
            company_type = settings.get('companyType', 'REGULAR')
            if company_type == 'REAL':
                return 'HT'
            elif company_type in ('REGULAR', 'MICRO'):
                return 'TTC'
            elif company_type == 'MIXED':
                return 'TTC' if settings.get('worksInTTC', True) else 'HT'
        except Exception:
            pass
        return 'TTC'

    @staticmethod
    def can_reclaim_vat(organization) -> bool:
        """Legacy: whether org can reclaim input VAT."""
        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(organization)
            return settings.get('companyType', 'REGULAR') == 'REAL'
        except Exception:
            return False

    @staticmethod
    def get_airsi_treatment(organization) -> str:
        """Legacy: AIRSI treatment for org."""
        try:
            from erp.services import ConfigurationService
            settings = ConfigurationService.get_global_settings(organization)
            ct = settings.get('companyType', 'REGULAR')
            return {'REAL': 'RECOVER', 'MICRO': 'EXPENSE'}.get(ct, 'CAPITALIZE')
        except Exception:
            return 'CAPITALIZE'

    # ── Core Math ─────────────────────────────────────────────────────

    @staticmethod
    def calculate_tax(amount: Decimal, rate: Decimal, mode: str = 'TTC') -> dict:
        """Calculate tax breakdown from a given amount."""
        amount = Decimal(str(amount))
        rate = Decimal(str(rate))

        if mode == 'HT':
            ht = amount
            tax = (ht * rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            ttc = ht + tax
        else:
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
        quantity = Decimal(str(quantity))
        unit_price = Decimal(str(unit_price))
        tax_rate = Decimal(str(tax_rate))

        unit_result = TaxCalculator.calculate_tax(unit_price, tax_rate, mode)

        if rounding == 'per_line':
            line_ht  = (unit_result['ht']  * quantity).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            line_tax = (unit_result['tax'] * quantity).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            line_ttc = line_ht + line_tax
        else:
            line_ht  = unit_result['ht']  * quantity
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
        total_ht = total_tax = total_ttc = Decimal('0')
        line_results = []

        for line in lines:
            result = TaxCalculator.calculate_line_tax(
                quantity=line['quantity'],
                unit_price=line['unit_price'],
                tax_rate=line['tax_rate'],
                mode=mode,
                rounding=rounding,
            )
            total_ht  += result['line_ht']
            total_tax += result['line_tax']
            total_ttc += result['line_ttc']
            line_results.append(result)

        if rounding == 'on_total':
            total_ht  = total_ht.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            total_tax = total_tax.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            total_ttc = total_ht + total_tax

        return {
            'total_ht': total_ht,
            'total_tax': total_tax,
            'total_ttc': total_ttc,
            'line_results': line_results,
        }

    # ── New Engine: Cost Resolution ────────────────────────────────────

    @staticmethod
    def resolve_effective_cost(
        unit_cost_ht: Decimal,
        unit_cost_ttc: Decimal,
        organization=None,
        pricing_cost_basis: str = 'AUTO',
        vat_recoverable: bool = False
    ) -> Decimal:
        """Legacy cost resolution — kept for backward compat."""
        unit_cost_ht  = Decimal(str(unit_cost_ht))
        unit_cost_ttc = Decimal(str(unit_cost_ttc))

        if pricing_cost_basis == 'FORCE_HT':
            return unit_cost_ht
        elif pricing_cost_basis == 'FORCE_TTC':
            return unit_cost_ttc
        return unit_cost_ht if vat_recoverable else unit_cost_ttc

    @staticmethod
    def resolve_purchase_costs(
        base_ht: Decimal,
        vat_rate: Decimal,
        airsi_rate: Decimal = Decimal('0'),
        ctx: 'TaxEngineContext' = None,
        supplier_vat_registered: bool = True,
        supplier_reverse_charge: bool = False,
        supplier_airsi_subject: bool = False,
    ) -> dict:
        """
        Full purchase cost resolver using the new engine.

        Scope guard runs first — VAT lines are only computed when ctx.vat_active is True.
        Reverse charge only triggers when vat_active AND supplier.reverse_charge.

        Returns:
            cost_official, cost_internal, cost_cash (at invoice time),
            vat_recoverable_amount, airsi_payable, ap_amount,
            tax_lines (list of tax entries)
        """
        if ctx is None:
            ctx = TaxEngineContext()

        base_ht       = Decimal(str(base_ht))
        vat_rate      = ctx.get_effective_vat_rate(Decimal(str(vat_rate)))
        airsi_rate    = Decimal(str(airsi_rate))

        vat_amount    = (base_ht * vat_rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        ttc           = base_ht + vat_amount
        airsi_amount  = (base_ht * airsi_rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

        tax_lines       = []
        vat_cost_impact = Decimal('0')
        vat_recoverable = Decimal('0')
        reverse_charge  = False

        # ── VAT (scope guard already in ctx.vat_active) ───────────────
        if ctx.vat_active:
            if supplier_reverse_charge:
                # Reverse charge: self-assess both sides — net = 0, cost not impacted
                reverse_charge = True
                vat_cost_impact = Decimal('0')
                vat_recoverable = vat_amount
                tax_lines.append({
                    'type': 'VAT_REVERSE_CHARGE',
                    'rate': float(vat_rate),
                    'amount': float(vat_amount),
                    'cost_impact_ratio': 0.0,
                })
            elif supplier_vat_registered:
                ratio           = ctx.vat_input_recoverability
                vat_cost_impact = (vat_amount * (Decimal('1') - ratio)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
                vat_recoverable = (vat_amount * ratio).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
                tax_lines.append({
                    'type': 'VAT',
                    'rate': float(vat_rate),
                    'amount': float(vat_amount),
                    'cost_impact_ratio': float(Decimal('1') - ratio),
                })
            # else: supplier doesn't charge VAT → no VAT lines, no cost impact
        else:
            # vat_active=False (INTERNAL scope or org not VAT-registered)
            # All VAT paid to supplier is a cost (capitalized)
            vat_cost_impact = vat_amount
            vat_recoverable = Decimal('0')
            # No tax_lines added because we don't track statutory VAT here

        # ── AIRSI ─────────────────────────────────────────────────────
        airsi_cost_impact = Decimal('0')
        if supplier_airsi_subject and airsi_amount > 0:
            treatment = ctx.airsi_treatment
            if treatment == 'CAPITALIZE':
                airsi_cost_impact = airsi_amount
            # RECOVER: goes to AIRSI Récupérable asset — not in cost
            # EXPENSE: goes to P&L — not in cost
            tax_lines.append({
                'type': 'AIRSI',
                'rate': float(airsi_rate),
                'amount': float(airsi_amount),
                'cost_impact_ratio': 1.0 if treatment == 'CAPITALIZE' else 0.0,
                'treatment': treatment,
            })

        # ── Purchase Tax ──────────────────────────────────────────────
        pt_cost_impact = Decimal('0')
        if ctx.purchase_tax_rate > 0:
            pt_amount = (base_ht * ctx.purchase_tax_rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            if ctx.purchase_tax_mode == 'CAPITALIZE':
                pt_cost_impact = pt_amount
            tax_lines.append({
                'type': 'PURCHASE_TAX',
                'rate': float(ctx.purchase_tax_rate),
                'amount': float(pt_amount),
                'cost_impact_ratio': 1.0 if ctx.purchase_tax_mode == 'CAPITALIZE' else 0.0,
            })
        else:
            pt_amount = Decimal('0')

        # ── Custom Dynamic Taxes ──────────────────────────────────────
        custom_cost_impact = Decimal('0')
        custom_withheld = Decimal('0')
        custom_added_ttc = Decimal('0')

        for rule in ctx.custom_rules:
            if rule.transaction_type in ('PURCHASE', 'BOTH'):
                c_amount = (base_ht * rule.rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
                if c_amount <= 0:
                    continue

                if rule.math_behavior == 'ADDED_TO_TTC':
                    custom_added_ttc += c_amount
                elif rule.math_behavior == 'WITHHELD_FROM_AP':
                    custom_withheld += c_amount
                
                c_impact_ratio = 1.0 if rule.purchase_cost_treatment == 'CAPITALIZE' else 0.0
                if c_impact_ratio > 0:
                    custom_cost_impact += c_amount

                tax_lines.append({
                    'type': 'CUSTOM',
                    'rate': float(rule.rate),
                    'amount': float(c_amount),
                    'cost_impact_ratio': c_impact_ratio,
                    'custom_tax_rule_id': rule.id,
                })

        ttc += custom_added_ttc

        # ── Cost Views ────────────────────────────────────────────────
        cost_official = base_ht + vat_cost_impact + airsi_cost_impact + pt_cost_impact + custom_cost_impact

        # Internal scope: TTC_ALWAYS means we always use TTC as cost
        if not ctx.vat_active and ctx.internal_cost_mode == 'TTC_ALWAYS':
            cost_internal = ttc
        elif ctx.internal_cost_mode == 'SAME_AS_OFFICIAL':
            cost_internal = cost_official
        else:
            cost_internal = ttc

        # AP = TTC owed to supplier (net of AIRSI if withheld)
        ap_amount   = ttc - airsi_amount if supplier_airsi_subject else ttc
        ap_amount  -= custom_withheld
        # cost_cash = actual cash at invoice time = ap_amount (may be 0 if fully on credit)
        cost_cash   = ap_amount

        return {
            'base_ht':           base_ht,
            'vat_amount':        vat_amount,
            'ttc':               ttc,
            'airsi_amount':      airsi_amount,
            'ap_amount':         ap_amount,        # owed to supplier
            'cost_official':     cost_official.quantize(TWOPLACES, rounding=ROUND_HALF_UP),
            'cost_internal':     cost_internal.quantize(TWOPLACES, rounding=ROUND_HALF_UP),
            'cost_cash':         cost_cash.quantize(TWOPLACES, rounding=ROUND_HALF_UP),
            'vat_recoverable':   vat_recoverable,
            'reverse_charge':    reverse_charge,
            'vat_active':        ctx.vat_active,
            'tax_lines':         tax_lines,
        }

    # ── Invoice Type Resolver ─────────────────────────────────────────

    @staticmethod
    def resolve_invoice_type(
        ctx: 'TaxEngineContext',
        client_vat_registered: bool = True,
    ) -> str:
        """
        Determine the invoice/document type for a sale.

        SCOPE GUARD: VAT invoice only possible when scope=OFFICIAL and org charges VAT.
        Export (ctx.is_export) forces zero-rate but keeps TVA Invoice if client is B2B.
        """
        if ctx.scope == 'INTERNAL':
            return 'INTERNAL_RECEIPT'

        if not ctx.vat_active:
            # Org not VAT-registered
            return 'SIMPLE_INVOICE'

        if ctx.is_export and not client_vat_registered:
            return 'RECEIPT'

        if client_vat_registered:
            return 'TVA_INVOICE'

        return 'RECEIPT'

    @staticmethod
    def calculate_sales_breakdown(
        base_ht: Decimal,
        vat_rate: Decimal,
        ctx: 'TaxEngineContext' = None,
    ) -> dict:
        """
        Final sales math for invoicing and ledger.
        Respects internal_sales_vat_mode (NONE vs DISPLAY_ONLY).
        
        Returns:
            ttc             - Total shown to customer
            vat_display     - VAT shown in UI/Invoice
            ledger_amount   - Amount to post to Revenue
            statutory_vat   - Amount to post to VAT Collected (0 for INTERNAL)
        """
        if ctx is None:
            ctx = TaxEngineContext()

        base_ht = Decimal(str(base_ht))
        rate = Decimal(str(vat_rate))
        vat_amount = (base_ht * rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

        if ctx.scope == 'INTERNAL':
            if ctx.internal_sales_vat_mode == 'NONE':
                return {
                    'ttc': base_ht,
                    'vat_display': Decimal('0.00'),
                    'ledger_amount': base_ht,
                    'statutory_vat': Decimal('0.00'),
                }
            else:  # DISPLAY_ONLY
                return {
                    'ttc': base_ht + vat_amount,
                    'vat_display': vat_amount,
                    'ledger_amount': base_ht,
                    'statutory_vat': Decimal('0.00'),
                }
        else:  # OFFICIAL
            if not ctx.vat_active:
                return {
                    'ttc': base_ht,
                    'vat_display': Decimal('0.00'),
                    'ledger_amount': base_ht,
                    'statutory_vat': Decimal('0.00'),
                }
            
            return {
                'ttc': base_ht + vat_amount,
                'vat_display': vat_amount,
                'ledger_amount': base_ht,
                'statutory_vat': vat_amount,
            }
