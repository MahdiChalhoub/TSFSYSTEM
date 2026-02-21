"""
Tax Calculator Service
=====================
Reusable tax calculation engine that respects company type configuration.
Extracts inline tax logic from POS/Purchase services into a standalone service.

Usage:
    from apps.finance.tax_calculator import TaxCalculator

    # Get tax mode for org
    mode = TaxCalculator.get_tax_mode(organization)  # 'HT' or 'TTC'

    # Calculate tax from a price
    result = TaxCalculator.calculate_tax(amount=1000, rate=Decimal('0.11'), mode='TTC')
    # result = {'ht': 900.90, 'tax': 99.10, 'ttc': 1000.00}
"""
from decimal import Decimal, ROUND_HALF_UP
import logging

logger = logging.getLogger(__name__)

TWOPLACES = Decimal('0.01')


class TaxCalculator:
    """
    Centralized tax calculation engine.

    Resolution hierarchy for tax mode:
    1. Explicit override (passed by caller)
    2. Organization global settings (companyType → auto-resolve)
    3. Default: TTC
    """

    # ── Tax Mode Resolution ──────────────────────────────────────────

    @staticmethod
    def get_tax_mode(organization) -> str:
        """
        Resolve the tax mode for an organization based on company type.

        Returns 'HT' or 'TTC'.

        Company type mapping:
        - REAL        → HT  (professional accounting, VAT tracked separately)
        - MIXED/OFF   → HT  (official scope uses HT)
        - MIXED/INT   → TTC (internal scope uses TTC)
        - REGULAR     → TTC (standard TTC-based pricing)
        - MICRO       → TTC (simplified flat-tax regime)
        - CUSTOM      → from settings
        """
        from erp.services import ConfigurationService

        settings = ConfigurationService.get_global_settings(organization)
        company_type = settings.get('companyType', 'REGULAR')
        works_in_ttc = settings.get('worksInTTC', True)

        if company_type == 'REAL':
            return 'HT'
        elif company_type in ('REGULAR', 'MICRO'):
            return 'TTC'
        elif company_type == 'MIXED':
            # For MIXED, caller should specify scope; default to TTC
            return 'TTC' if works_in_ttc else 'HT'
        elif company_type == 'CUSTOM':
            return 'TTC' if works_in_ttc else 'HT'
        return 'TTC'

    @staticmethod
    def can_reclaim_vat(organization) -> bool:
        """
        Whether this organization can reclaim input VAT on purchases.

        - REAL        → True (full VAT recovery)
        - MIXED       → depends on scope (official → True, internal → False)
        - REGULAR     → False
        - MICRO       → False
        """
        from erp.services import ConfigurationService

        settings = ConfigurationService.get_global_settings(organization)
        company_type = settings.get('companyType', 'REGULAR')

        if company_type == 'REAL':
            return True
        elif company_type in ('REGULAR', 'MICRO'):
            return False
        elif company_type == 'MIXED':
            # In MIXED mode, VAT reclaimability depends on scope
            # Caller must handle this; default False for safety
            return False
        return False

    @staticmethod
    def get_airsi_treatment(organization) -> str:
        """
        How AIRSI withholding tax is treated for this company type.

        Returns: 'CAPITALIZE' | 'RECOVER' | 'EXPENSE'
        """
        from erp.services import ConfigurationService

        settings = ConfigurationService.get_global_settings(organization)
        company_type = settings.get('companyType', 'REGULAR')

        if company_type == 'REAL':
            return 'RECOVER'
        elif company_type == 'MICRO':
            return 'EXPENSE'
        return 'CAPITALIZE'

    # ── Core Tax Math ────────────────────────────────────────────────

    @staticmethod
    def calculate_tax(amount: Decimal, rate: Decimal, mode: str = 'TTC') -> dict:
        """
        Calculate tax breakdown from a given amount.

        Args:
            amount: The input amount (either HT or TTC depending on mode)
            rate: Tax rate as a decimal (e.g., Decimal('0.11') for 11%)
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
            tax_rate: Tax rate as decimal (e.g., 0.11)
            mode: 'HT' or 'TTC'
            rounding: 'per_line' (round each line) or 'on_total' (accumulate raw)

        Returns:
            dict: unit_ht, unit_ttc, line_ht, line_tax, line_ttc
        """
        quantity = Decimal(str(quantity))
        unit_price = Decimal(str(unit_price))
        tax_rate = Decimal(str(tax_rate))

        # Per-unit breakdown
        unit_result = TaxCalculator.calculate_tax(unit_price, tax_rate, mode)

        if rounding == 'per_line':
            line_ht = (unit_result['ht'] * quantity).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            line_tax = (unit_result['tax'] * quantity).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            line_ttc = line_ht + line_tax
        else:
            # on_total: keep raw precision, caller will round final total
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
