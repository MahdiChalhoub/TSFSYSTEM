"""
eCommerce Promotions Engine v2
================================
Evaluates cart-level promotions at place_order time.
No coupon code required — fires automatically when conditions are met.

Supported rule types:
  SPEND_THRESHOLD  → subtract % or flat amount from cart total
  BOGO             → add free line items to order
  BUNDLE           → verify product set present, then apply cart discount
  MIN_QUANTITY     → apply % off matching product lines

Evaluation order:
  1. Collect all active, valid CartPromotion records for this org
  2. Filter to those whose conditions the cart satisfies
  3. Non-stackable: only highest-priority promo is applied
  4. Stackable promos: all applied in priority order
  5. Results recorded in CartPromotionUsage for audit

Usage:
    from apps.client_portal.promotion_service import PromotionService

    PromotionService.apply_promotions(order)   # mutates order in place
"""
import logging
from decimal import Decimal
from django.utils import timezone

logger = logging.getLogger('client_portal.promotions')


class PromotionService:

    @classmethod
    def evaluate_cart(cls, order) -> list:
        """
        Returns list of promos that would apply to this order (without modifying it).

        Returns:
            [
              {
                'promotion': CartPromotion,
                'discount': Decimal,
                'description': str,
              },
              ...
            ]
        """
        from apps.client_portal.models.promotion_models import CartPromotion

        now = timezone.now()
        active_promos = CartPromotion.objects.filter(
            organization=order.organization,
            is_active=True,
        ).filter(
            models_Q(valid_from__isnull=True) | models_Q(valid_from__lte=now),
        ).filter(
            models_Q(valid_until__isnull=True) | models_Q(valid_until__gte=now),
        ).order_by('-priority')

        applicable = []
        for promo in active_promos:
            try:
                result = cls._evaluate_one(promo, order)
                if result is not None:
                    applicable.append(result)
            except Exception as e:
                logger.warning(f"[Promotions] Promo #{promo.id} evaluation error: {e}")

        return applicable

    @classmethod
    def apply_promotions(cls, order) -> Decimal:
        """
        Applies eligible promotions to the order, updates discount_amount,
        and writes CartPromotionUsage records.

        Returns total discount applied.
        """
        applicable = cls.evaluate_cart(order)
        if not applicable:
            return Decimal('0.00')

        # Partition stackable vs non-stackable
        stackable = [r for r in applicable if r['promotion'].stackable]
        non_stackable = [r for r in applicable if not r['promotion'].stackable]

        to_apply = list(stackable)
        if non_stackable:
            # Pick only highest-priority non-stackable
            to_apply.append(non_stackable[0])

        total_discount = Decimal('0.00')

        for result in to_apply:
            promo = result['promotion']
            discount = result['discount']
            free_lines = result.get('free_lines', [])

            # Per-customer limit
            if promo.one_per_customer and order.contact:
                already_used = cls._contact_used_promo(promo, order.contact, order.organization)
                if already_used:
                    logger.info(f"[Promotions] Promo '{promo.name}' skipped — one-per-customer limit for contact #{order.contact.id}")
                    continue

            # Global use limit
            if promo.max_uses is not None and promo.used_count >= promo.max_uses:
                logger.info(f"[Promotions] Promo '{promo.name}' skipped — max_uses reached")
                continue

            # Apply cart-level discount
            if discount > 0:
                order.discount_amount = (order.discount_amount or Decimal('0')) + discount
                total_discount += discount

            # Apply BOGO free lines
            for fl in free_lines:
                cls._add_free_line(order, fl['product_id'], fl['quantity'])

            # Record usage
            try:
                from apps.client_portal.models.promotion_models import CartPromotionUsage
                CartPromotionUsage.objects.create(
                    organization=order.organization,
                    promotion=promo,
                    order=order,
                    contact=order.contact,
                    discount_applied=discount + sum(fl.get('value', Decimal('0')) for fl in free_lines),
                )
                promo.used_count += 1
                promo.save(update_fields=['used_count'])
            except Exception as e:
                logger.warning(f"[Promotions] Failed to record usage for promo #{promo.id}: {e}")

            logger.info(
                f"[Promotions] Applied '{promo.name}' ({promo.rule_type}) "
                f"to order {order.order_number}: discount={discount}"
            )

        if total_discount > 0:
            order.recalculate_totals()

        return total_discount

    # ── Evaluators ────────────────────────────────────────────────────────────

    @classmethod
    def _evaluate_one(cls, promo, order) -> dict | None:
        """Dispatch to rule-specific evaluator. Returns None if promo doesn't apply."""
        rule_type = promo.rule_type
        if rule_type == 'SPEND_THRESHOLD':
            return cls._eval_spend_threshold(promo, order)
        elif rule_type == 'BOGO':
            return cls._eval_bogo(promo, order)
        elif rule_type == 'BUNDLE':
            return cls._eval_bundle(promo, order)
        elif rule_type == 'MIN_QUANTITY':
            return cls._eval_min_quantity(promo, order)
        else:
            logger.warning(f"[Promotions] Unknown rule type: {rule_type}")
            return None

    @classmethod
    def _eval_spend_threshold(cls, promo, order) -> dict | None:
        """
        Fires when order.subtotal >= conditions.min_subtotal.
        Reward: PERCENT_OFF_CART or FIXED_OFF_CART.
        """
        cond = promo.conditions
        reward = promo.reward
        min_subtotal = Decimal(str(cond.get('min_subtotal', 0)))

        if order.subtotal < min_subtotal:
            return None

        discount = cls._compute_cart_reward(reward, order.subtotal)
        return {
            'promotion': promo,
            'discount': discount,
            'description': f"{promo.name}: -{discount} off (subtotal {order.subtotal} ≥ {min_subtotal})",
        }

    @classmethod
    def _eval_bogo(cls, promo, order) -> dict | None:
        """
        Fires when cart contains >= buy_quantity of the specified product.
        Adds free_quantity free units (price=0) to the order.
        """
        cond = promo.conditions
        product_id = cond.get('product_id')
        buy_qty = Decimal(str(cond.get('buy_quantity', 1)))
        free_qty = Decimal(str(promo.reward.get('free_quantity', 1)))

        # Check if product is in cart
        matching_lines = [l for l in order.lines.all() if l.product_id == product_id]
        if not matching_lines:
            return None

        total_in_cart = sum(l.quantity for l in matching_lines)
        if total_in_cart < buy_qty:
            return None

        # Calculate how many free items to add (can tier: buy 4 get 2, buy 6 get 3...)
        multiplier = int(total_in_cart / buy_qty)
        units_free = free_qty * multiplier

        return {
            'promotion': promo,
            'discount': Decimal('0'),  # no discount, free lines added instead
            'free_lines': [{'product_id': product_id, 'quantity': units_free, 'value': Decimal('0')}],
            'description': f"{promo.name}: {units_free} free units of product #{product_id}",
        }

    @classmethod
    def _eval_bundle(cls, promo, order) -> dict | None:
        """
        Fires when all required product_ids are present in the cart.
        Reward: PERCENT_OFF_CART or FIXED_OFF_CART.
        """
        cond = promo.conditions
        required_ids = set(cond.get('product_ids', []))
        if not required_ids:
            return None

        cart_product_ids = {l.product_id for l in order.lines.all() if l.product_id}
        if not required_ids.issubset(cart_product_ids):
            return None

        discount = cls._compute_cart_reward(promo.reward, order.subtotal)
        return {
            'promotion': promo,
            'discount': discount,
            'description': f"{promo.name}: bundle discount -{discount}",
        }

    @classmethod
    def _eval_min_quantity(cls, promo, order) -> dict | None:
        """
        Fires when cart has >= min_quantity of the specified product.
        Reward: PERCENT_OFF_LINE applied to that product's lines.
        """
        cond = promo.conditions
        product_id = cond.get('product_id')
        min_qty = Decimal(str(cond.get('min_quantity', 1)))
        pct_off = Decimal(str(promo.reward.get('value', 0)))

        matching_lines = [l for l in order.lines.all() if l.product_id == product_id]
        if not matching_lines:
            return None

        total_qty = sum(l.quantity for l in matching_lines)
        if total_qty < min_qty:
            return None

        # Compute discount as % off the matched lines' totals
        line_total = sum(l.line_total for l in matching_lines)
        discount = (line_total * pct_off / 100).quantize(Decimal('0.01'))
        return {
            'promotion': promo,
            'discount': discount,
            'description': f"{promo.name}: {pct_off}% off {total_qty} units of product #{product_id}",
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _compute_cart_reward(reward: dict, subtotal: Decimal) -> Decimal:
        reward_type = reward.get('type')
        value = Decimal(str(reward.get('value', 0)))

        if reward_type == 'PERCENT_OFF_CART':
            return (subtotal * value / 100).quantize(Decimal('0.01'))
        elif reward_type == 'FIXED_OFF_CART':
            return min(value, subtotal)
        return Decimal('0.00')

    @staticmethod
    def _add_free_line(order, product_id: int, quantity: Decimal) -> None:
        """Inserts a zero-price line item into the order for BOGO rewards."""
        from apps.inventory.models import Product
        from apps.client_portal.models import ClientOrderLine
        try:
            product = Product.objects.get(id=product_id)
            ClientOrderLine.objects.create(
                organization=order.organization,
                order=order,
                product=product,
                product_name=f"{product.name} (FREE)",
                quantity=quantity,
                unit_price=Decimal('0.00'),
                tax_rate=Decimal('0.00'),
                discount_percent=Decimal('0.00'),
            )
        except Exception as e:
            logger.error(f"[Promotions] Failed to add free line for product #{product_id}: {e}")

    @staticmethod
    def _contact_used_promo(promo, contact, organization) -> bool:
        """True if this contact has already used this promotion."""
        from apps.client_portal.models.promotion_models import CartPromotionUsage
        return CartPromotionUsage.objects.filter(
            organization=organization,
            promotion=promo,
            contact=contact,
        ).exists()


# Local import alias to avoid circular import issues
def models_Q(*args, **kwargs):
    from django.db.models import Q
    return Q(*args, **kwargs)
