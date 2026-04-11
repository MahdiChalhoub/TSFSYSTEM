"""
Price Regulation Service
========================
Core compliance engine for price regulation enforcement.

Responsibilities:
  - Validate product prices against active regulations
  - Match products to regulation rules (specificity-based)
  - Bulk compliance checks across all regulated products
  - Auto-enrollment of new products matching rules
  - Audit logging for every enforcement action

All external modules (POS, Inventory) should access this service
through the ConnectorEngine capability: "compliance.price.validate"
"""
import logging
from decimal import Decimal
from django.db.models import Q
from django.utils import timezone

from apps.compliance.models import PriceRegulation, RegulationRule, RegulationAuditLog

logger = logging.getLogger(__name__)


class ComplianceResult:
    """Result of a price compliance check."""

    def __init__(self, compliant=True, action='ALLOW', regulated_price=None,
                 violation_amount=None, regulation=None, message=''):
        self.compliant = compliant
        self.action = action          # ALLOW, BLOCK, CLAMP, WARN
        self.regulated_price = regulated_price
        self.violation_amount = violation_amount
        self.regulation = regulation
        self.message = message

    def to_dict(self):
        return {
            'compliant': self.compliant,
            'action': self.action,
            'regulated_price': float(self.regulated_price) if self.regulated_price else None,
            'violation_amount': float(self.violation_amount) if self.violation_amount else None,
            'regulation_code': self.regulation.code if self.regulation else None,
            'regulation_type': self.regulation.regulation_type if self.regulation else None,
            'message': self.message,
        }


class PriceRegulationService:
    """Core service for price regulation compliance."""

    def validate_price(self, product, price, source='manual', scope='BOTH',
                       sale_country=None, user=None):
        """
        Check if a product's price complies with applicable regulations.

        Args:
            product: Product instance
            price: Decimal price to validate
            source: Where the check originates (pos, product_save, etc.)
            scope: OFFICIAL, INTERNAL, or BOTH
            sale_country: Country where the sale happens (for jurisdiction matching)
            user: User performing the action (for audit)

        Returns:
            ComplianceResult with action recommendation
        """
        price = Decimal(str(price))

        # Find applicable regulation
        regulation = self._find_regulation(product, scope, sale_country)
        if not regulation:
            return ComplianceResult(compliant=True, action='ALLOW')

        # Check compliance
        result = self._check_price(regulation, price)

        # Log audit entry if non-compliant
        if not result.compliant:
            self._log_violation(
                product=product,
                regulation=regulation,
                price=price,
                result=result,
                source=source,
                scope=scope,
                user=user,
            )

        return result

    def _find_regulation(self, product, scope='BOTH', sale_country=None):
        """
        Find the applicable regulation for a product.
        Priority:
          1. Direct product.price_regulation link
          2. Best matching RegulationRule
        """
        # 1. Direct link
        reg = getattr(product, 'price_regulation', None)
        if reg and reg.status == 'ACTIVE' and reg.is_current:
            if self._scope_matches(reg, scope):
                return reg

        # 2. Rule-based match
        return self.match_product_to_rules(product, scope, sale_country)

    def match_product_to_rules(self, product, scope='BOTH', sale_country=None):
        """
        Find the most specific regulation rule matching this product.
        Returns the PriceRegulation from the best match, or None.
        """
        rules = RegulationRule.objects.filter(
            organization=product.organization,
            is_active=True,
            regulation__status='ACTIVE',
            regulation__is_current=True,
        ).select_related('regulation', 'regulation__currency')

        # Jurisdiction filter
        if sale_country:
            rules = rules.filter(
                Q(regulation__jurisdiction_country=sale_country) |
                Q(regulation__jurisdiction_country__isnull=True)
            )

        # Scope filter
        rules = rules.filter(
            Q(regulation__scope=scope) |
            Q(regulation__scope='BOTH')
        )

        # Evaluate each rule
        candidates = []
        for rule in rules:
            if rule.matches_product(product):
                specificity = rule.compute_specificity()
                # Country-specific > global (bonus for having jurisdiction set)
                if rule.regulation.jurisdiction_country_id:
                    specificity += 5
                candidates.append((specificity, rule))

        if not candidates:
            return None

        # Highest specificity wins
        candidates.sort(key=lambda x: -x[0])
        return candidates[0][1].regulation

    def _check_price(self, regulation, price):
        """Check price against regulation type with tolerance."""
        reg = regulation
        tolerance = reg.tolerance

        if reg.regulation_type == 'FIXED':
            diff = abs(price - reg.fixed_price)
            if diff > tolerance:
                action = 'CLAMP' if reg.auto_correct else (
                    'BLOCK' if reg.severity == 'BLOCKING' else 'WARN'
                )
                return ComplianceResult(
                    compliant=False,
                    action=action,
                    regulated_price=reg.fixed_price,
                    violation_amount=price - reg.fixed_price,
                    regulation=reg,
                    message=f'Government fixed price: {reg.fixed_price} {reg.currency.code}. '
                            f'Current: {price}. Diff: {price - reg.fixed_price}'
                )

        elif reg.regulation_type == 'MAX':
            effective_max = reg.max_price + tolerance
            if price > effective_max:
                action = 'CLAMP' if reg.auto_correct else (
                    'BLOCK' if reg.severity == 'BLOCKING' else 'WARN'
                )
                return ComplianceResult(
                    compliant=False,
                    action=action,
                    regulated_price=reg.max_price,
                    violation_amount=price - reg.max_price,
                    regulation=reg,
                    message=f'Exceeds government max: {reg.max_price} {reg.currency.code}. '
                            f'Current: {price}. Over by: {price - reg.max_price}'
                )

        elif reg.regulation_type == 'MIN':
            effective_min = reg.min_price - tolerance
            if price < effective_min:
                action = 'CLAMP' if reg.auto_correct else (
                    'BLOCK' if reg.severity == 'BLOCKING' else 'WARN'
                )
                return ComplianceResult(
                    compliant=False,
                    action=action,
                    regulated_price=reg.min_price,
                    violation_amount=price - reg.min_price,
                    regulation=reg,
                    message=f'Below government min: {reg.min_price} {reg.currency.code}. '
                            f'Current: {price}. Under by: {reg.min_price - price}'
                )

        elif reg.regulation_type == 'RANGE':
            effective_max = reg.max_price + tolerance
            effective_min = reg.min_price - tolerance
            if price > effective_max:
                action = 'CLAMP' if reg.auto_correct else (
                    'BLOCK' if reg.severity == 'BLOCKING' else 'WARN'
                )
                return ComplianceResult(
                    compliant=False,
                    action=action,
                    regulated_price=reg.max_price,
                    violation_amount=price - reg.max_price,
                    regulation=reg,
                    message=f'Exceeds government range max: {reg.max_price} {reg.currency.code}'
                )
            if price < effective_min:
                action = 'CLAMP' if reg.auto_correct else (
                    'BLOCK' if reg.severity == 'BLOCKING' else 'WARN'
                )
                return ComplianceResult(
                    compliant=False,
                    action=action,
                    regulated_price=reg.min_price,
                    violation_amount=price - reg.min_price,
                    regulation=reg,
                    message=f'Below government range min: {reg.min_price} {reg.currency.code}'
                )

        return ComplianceResult(compliant=True, action='ALLOW', regulation=reg)

    def _scope_matches(self, regulation, scope):
        """Check if regulation scope matches the requested scope."""
        if regulation.scope == 'BOTH':
            return True
        return regulation.scope == scope

    def _log_violation(self, product, regulation, price, result, source, scope, user):
        """Create audit log entry for a violation."""
        action_map = {
            'BLOCK': 'VIOLATION_DETECTED',
            'CLAMP': 'AUTO_FIX',
            'WARN': 'SAVE_WARNING',
        }
        RegulationAuditLog.log(
            organization=product.organization,
            action=action_map.get(result.action, 'VIOLATION_DETECTED'),
            product=product,
            regulation=regulation,
            old_price=price,
            new_price=result.regulated_price if result.action == 'CLAMP' else None,
            regulated_price=result.regulated_price,
            violation_amount=result.violation_amount,
            source=source,
            scope=scope,
            user=user,
        )

    def bulk_compliance_check(self, organization, auto_fix=False, user=None):
        """
        Scan ALL regulated products in an organization.
        Returns summary dict with violations found/fixed.
        """
        from apps.inventory.models import Product

        # Get all products with a regulation link
        products = Product.objects.filter(
            organization=organization,
            price_regulation__isnull=False,
            price_regulation__status='ACTIVE',
            price_regulation__is_current=True,
        ).select_related('price_regulation', 'price_regulation__currency')

        total = 0
        violations = 0
        fixed = 0

        for product in products:
            total += 1
            reg = product.price_regulation
            price = product.selling_price_ttc  # Default check field

            result = self._check_price(reg, price)

            if not result.compliant:
                violations += 1
                product.regulation_status = 'VIOLATION'
                product.regulation_violation_amount = result.violation_amount

                if auto_fix and result.action in ('CLAMP',):
                    product.selling_price_ttc = result.regulated_price
                    product.regulation_status = 'COMPLIANT'
                    product.regulation_violation_amount = None
                    fixed += 1

                    RegulationAuditLog.log(
                        organization=organization,
                        action='BULK_FIX',
                        product=product,
                        regulation=reg,
                        old_price=price,
                        new_price=result.regulated_price,
                        regulated_price=result.regulated_price,
                        violation_amount=result.violation_amount,
                        source='compliance_check',
                        user=user,
                    )

                product.regulation_checked_at = timezone.now()
                product.save(update_fields=[
                    'regulation_status', 'regulation_violation_amount',
                    'regulation_checked_at',
                ] + (['selling_price_ttc'] if auto_fix else []))
            else:
                if product.regulation_status != 'COMPLIANT':
                    product.regulation_status = 'COMPLIANT'
                    product.regulation_violation_amount = None
                    product.regulation_checked_at = timezone.now()
                    product.save(update_fields=[
                        'regulation_status', 'regulation_violation_amount',
                        'regulation_checked_at',
                    ])

        return {
            'total_checked': total,
            'violations_found': violations,
            'auto_fixed': fixed,
            'still_violating': violations - fixed,
        }

    def auto_enroll_product(self, product, user=None):
        """
        Called when a product is created/updated.
        Matches against rules and applies regulation + optional group.
        Returns the matched regulation or None.
        """
        matched_rule = self._find_best_rule(product)

        if not matched_rule:
            # No rule matches — clear any stale regulation
            if product.price_regulation_id and product.regulation_status != 'EXEMPT':
                product.price_regulation = None
                product.regulation_status = 'NOT_REGULATED'
                product.save(update_fields=['price_regulation', 'regulation_status'])
            return None

        regulation = matched_rule.regulation

        # Apply regulation
        changed = product.price_regulation_id != regulation.id
        product.price_regulation = regulation
        product.regulation_checked_at = timezone.now()

        # Auto-enroll into ProductGroup
        if matched_rule.price_group_id:
            # Add to group (implementation depends on ProductGroup model)
            try:
                from apps.inventory.models import Product as P
                if product.product_group_id != matched_rule.price_group_id:
                    product.product_group_id = matched_rule.price_group_id
            except Exception:
                pass

        # Check compliance immediately
        price = product.selling_price_ttc
        result = self._check_price(regulation, price)
        product.regulation_status = 'VIOLATION' if not result.compliant else 'COMPLIANT'
        product.regulation_violation_amount = result.violation_amount if not result.compliant else None

        product.save(update_fields=[
            'price_regulation', 'regulation_status',
            'regulation_violation_amount', 'regulation_checked_at',
        ])

        if changed:
            RegulationAuditLog.log(
                organization=product.organization,
                action='REGULATION_APPLIED',
                product=product,
                regulation=regulation,
                old_price=price,
                regulated_price=result.regulated_price,
                source='compliance_check',
                user=user,
            )

        return regulation

    def _find_best_rule(self, product):
        """Find the highest-specificity rule matching this product."""
        rules = RegulationRule.objects.filter(
            organization=product.organization,
            is_active=True,
            regulation__status='ACTIVE',
            regulation__is_current=True,
        ).select_related('regulation')

        candidates = []
        for rule in rules:
            if rule.matches_product(product):
                candidates.append((rule.compute_specificity(), rule))

        if not candidates:
            return None

        candidates.sort(key=lambda x: -x[0])
        return candidates[0][1]
