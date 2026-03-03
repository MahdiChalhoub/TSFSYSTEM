"""
CRM Pricing Service
====================
Resolves the effective unit price for a product+contact combination
by applying the full priority chain of ClientPriceRule / PriceGroup rules.

Resolution order (first match wins):
  1. Direct contact rule with highest specificity:
       - Product-specific rule beats category-level rule
       - FIXED_PRICE beats PERCENTAGE beats AMOUNT_OFF (if tied on specificity)
  2. Highest-priority PriceGroup rule the contact belongs to
       - Filtered by PriceGroupMember → ordered by PriceGroup.priority DESC
  3. product.selling_price_ttc  (default retail / no negotiated price)

Usage:
    from apps.crm.services.pricing_service import PricingService

    price = PricingService.resolve_price(
        product=product,
        contact=order.contact,
        quantity=line.quantity,
        organization=order.organization,
    )
"""
import logging
from decimal import Decimal
from django.utils import timezone

logger = logging.getLogger(__name__)


class PricingService:

    @staticmethod
    def resolve_price(
        product,
        contact=None,
        quantity: Decimal = Decimal('1'),
        organization=None,
    ) -> Decimal:
        """
        Returns the best applicable unit price for the given product + contact.

        Args:
            product:      inventory.Product instance
            contact:      crm.Contact instance (may be None for guest B2C)
            quantity:     order line quantity (for min_quantity checks)
            organization: erp.Organization instance (for tenant isolation)

        Returns:
            Decimal — effective unit price (TTC, matching product.selling_price_ttc scale)
        """
        base_price = product.selling_price_ttc

        if contact is None:
            return base_price

        today = timezone.now().date()

        # ── Step 1: direct contact-level rules ──────────────────────────────
        direct_rule = PricingService._find_best_rule(
            rules_qs=PricingService._get_direct_rules(contact, product, organization, today, quantity),
            base_price=base_price,
        )
        if direct_rule is not None:
            logger.debug(
                f"[Pricing] Direct rule applied for contact #{contact.id} "
                f"on product #{product.id}: {direct_rule}"
            )
            return direct_rule

        # ── Step 2: price group rules ────────────────────────────────────────
        group_rule = PricingService._find_best_group_rule(
            contact=contact,
            product=product,
            organization=organization,
            today=today,
            quantity=quantity,
            base_price=base_price,
        )
        if group_rule is not None:
            logger.debug(
                f"[Pricing] Group rule applied for contact #{contact.id} "
                f"on product #{product.id}: {group_rule}"
            )
            return group_rule

        # ── Step 3: retail default ───────────────────────────────────────────
        return base_price

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _get_direct_rules(contact, product, organization, today, quantity):
        """QuerySet of active direct rules for this contact × product."""
        from apps.crm.models import ClientPriceRule
        from django.db.models import Q

        return ClientPriceRule.objects.filter(
            organization=organization,
            contact_id=contact.id,
            price_group__isnull=True,
            is_active=True,
            min_quantity__lte=quantity,
        ).filter(
            Q(product_id=product.id) | Q(product_id__isnull=True),
        ).filter(
            Q(valid_from__isnull=True) | Q(valid_from__lte=today),
        ).filter(
            Q(valid_until__isnull=True) | Q(valid_until__gte=today),
        ).order_by(
            # Product-specific rules first, then category, then all-product
            '-product_id', '-category_id',
        )

    @staticmethod
    def _find_best_rule(rules_qs, base_price: Decimal):
        """
        Evaluate a rules queryset and return the first applicable computed price.
        Returns None if no rules apply.
        """
        for rule in rules_qs:
            computed = PricingService._apply_rule(rule, base_price)
            if computed is not None:
                return computed
        return None

    @staticmethod
    def _find_best_group_rule(contact, product, organization, today, quantity, base_price):
        """
        Walk the contact's PriceGroups in priority order (highest first),
        and return the first matching rule's computed price.
        """
        from apps.crm.models import PriceGroupMember, ClientPriceRule
        from django.db.models import Q

        # Get ordered list of this contact's group IDs (highest priority first)
        group_ids = list(
            PriceGroupMember.objects.filter(
                organization=organization,
                contact_id=contact.id,
                price_group__is_active=True,
            ).filter(
                Q(price_group__valid_from__isnull=True) | Q(price_group__valid_from__lte=today),
            ).filter(
                Q(price_group__valid_until__isnull=True) | Q(price_group__valid_until__gte=today),
            ).select_related('price_group').order_by(
                '-price_group__priority',
            ).values_list('price_group_id', flat=True)
        )

        if not group_ids:
            return None

        # For each group in priority order, find a matching rule
        for group_id in group_ids:
            rules = ClientPriceRule.objects.filter(
                organization=organization,
                price_group_id=group_id,
                contact_id__isnull=True,
                is_active=True,
                min_quantity__lte=quantity,
            ).filter(
                Q(product_id=product.id) | Q(product_id__isnull=True),
            ).filter(
                Q(valid_from__isnull=True) | Q(valid_from__lte=today),
            ).filter(
                Q(valid_until__isnull=True) | Q(valid_until__gte=today),
            ).order_by('-product_id', '-category_id')

            result = PricingService._find_best_rule(rules, base_price)
            if result is not None:
                return result

        return None

    @staticmethod
    def _apply_rule(rule, base_price: Decimal) -> Decimal | None:
        """
        Compute the effective price from a ClientPriceRule.

        Returns:
            Decimal — price after applying the rule
            None    — if the rule is malformed or results in zero/negative
        """
        try:
            value = Decimal(str(rule.value))
            if rule.discount_type == 'FIXED_PRICE':
                result = value
            elif rule.discount_type == 'PERCENTAGE':
                result = base_price * (Decimal('1') - value / Decimal('100'))
            elif rule.discount_type == 'AMOUNT_OFF':
                result = base_price - value
            else:
                return None

            # Clamp at 0 — a rule cannot result in a negative price
            result = max(result, Decimal('0.00'))
            return result.quantize(Decimal('0.01'))
        except Exception as e:
            logger.warning(f"[Pricing] Rule {rule.id} application failed: {e}")
            return None

    @staticmethod
    def get_price_breakdown(product, contact, quantity=1, organization=None) -> dict:
        """
        Returns a structured breakdown explaining the pricing decision.
        Useful for storefront display ("VIP Price: 12,000 — was 15,000").

        Returns:
            {
                'effective_price': Decimal,
                'base_price': Decimal,
                'discount_applied': bool,
                'discount_source': 'DIRECT_RULE' | 'GROUP_RULE' | 'RETAIL',
                'discount_amount': Decimal,
                'discount_percent': Decimal,
                'price_group_name': str | None,
            }
        """
        base_price = product.selling_price_ttc
        quantity = Decimal(str(quantity))
        today = timezone.now().date()

        source = 'RETAIL'
        group_name = None

        # Direct rule?
        if contact:
            direct_qs = PricingService._get_direct_rules(contact, product, organization, today, quantity)
            for rule in direct_qs:
                computed = PricingService._apply_rule(rule, base_price)
                if computed is not None:
                    source = 'DIRECT_RULE'
                    effective = computed
                    discount = base_price - effective
                    pct = (discount / base_price * 100) if base_price else Decimal('0')
                    return {
                        'effective_price': effective,
                        'base_price': base_price,
                        'discount_applied': discount > 0,
                        'discount_source': source,
                        'discount_amount': discount,
                        'discount_percent': pct.quantize(Decimal('0.01')),
                        'price_group_name': None,
                    }

            # Group rule?
            from apps.crm.models import PriceGroupMember, ClientPriceRule
            from django.db.models import Q
            group_members = PriceGroupMember.objects.filter(
                organization=organization, contact_id=contact.id,
                price_group__is_active=True,
            ).select_related('price_group').order_by('-price_group__priority')

            for member in group_members:
                group = member.price_group
                if group.valid_from and group.valid_from > today:
                    continue
                if group.valid_until and group.valid_until < today:
                    continue
                rules = ClientPriceRule.objects.filter(
                    organization=organization,
                    price_group=group,
                    is_active=True,
                    min_quantity__lte=quantity,
                ).filter(Q(product_id=product.id) | Q(product_id__isnull=True)).order_by('-product_id')

                for rule in rules:
                    computed = PricingService._apply_rule(rule, base_price)
                    if computed is not None:
                        source = 'GROUP_RULE'
                        group_name = group.name
                        effective = computed
                        discount = base_price - effective
                        pct = (discount / base_price * 100) if base_price else Decimal('0')
                        return {
                            'effective_price': effective,
                            'base_price': base_price,
                            'discount_applied': discount > 0,
                            'discount_source': source,
                            'discount_amount': discount,
                            'discount_percent': pct.quantize(Decimal('0.01')),
                            'price_group_name': group_name,
                        }

        return {
            'effective_price': base_price,
            'base_price': base_price,
            'discount_applied': False,
            'discount_source': 'RETAIL',
            'discount_amount': Decimal('0.00'),
            'discount_percent': Decimal('0.00'),
            'price_group_name': None,
        }
