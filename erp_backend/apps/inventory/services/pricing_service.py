"""
ProductGroupPricingService — 3-Level Pricing Engine
====================================================

Level 1: Product Group Price Sync
  - Changing the base price updates all member products
  
Level 2: Packaging Formula Pricing
  - Per-level discount % applied to base price × ratio
  
Level 3: Client/Tier Price Override
  - Resolved via CRM ClientPriceRule (already exists)

Resolution Order (first match wins):
  1. ClientPriceRule (contact-specific)
  2. ClientPriceRule (price_group match)
  3. ClientPriceRule (customer_tier match)
  4. ProductPackaging.effective_selling_price (formula or fixed)
  5. ProductGroup.base_selling_price_ttc (group price)
  6. Product.selling_price_ttc (default)
"""
import logging
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

from erp.connector_registry import connector

TWO_PLACES = Decimal('0.01')


class ProductGroupPricingService:
    """Service for managing multi-level pricing across product groups."""

    # ── Rounding Rules ──
    ROUNDING_TABLE = {
        'NEAREST_5':    Decimal('5'),
        'NEAREST_10':   Decimal('10'),
        'NEAREST_50':   Decimal('50'),
        'NEAREST_100':  Decimal('100'),
        'NEAREST_1000': Decimal('1000'),
    }

    @classmethod
    def _apply_rounding(cls, price, rule):
        """Apply a rounding rule to a price value."""
        if not rule or rule == 'NONE':
            return price.quantize(TWO_PLACES, ROUND_HALF_UP)
        step = cls.ROUNDING_TABLE.get(rule)
        if step:
            return (price / step).quantize(Decimal('1'), ROUND_HALF_UP) * step
        return price.quantize(TWO_PLACES, ROUND_HALF_UP)

    @staticmethod
    @transaction.atomic
    def sync_group_prices(group, new_base_price_ttc=None, new_base_price_ht=None):
        """
        Level 1: Update the group's reference price and cascade to all member products.
        Supports 5 pricing modes:
          FIXED        — All members get the exact base price
          MARGIN_RULE  — selling = cost / (1 - margin_rule_pct/100)
          CEILING      — Members capped at base price (no increase allowed)
          BAND         — Price looked up from price_band_values JSON by cost bracket
          MANUAL       — Only mark products as PENDING, don't auto-change prices
        """
        from apps.inventory.models import Product

        # Update group base price if provided
        if new_base_price_ttc is not None:
            group.base_selling_price_ttc = new_base_price_ttc
        if new_base_price_ht is not None:
            group.base_selling_price_ht = new_base_price_ht
        group.last_synced_at = timezone.now()
        group.save(update_fields=['base_selling_price_ttc', 'base_selling_price_ht', 'last_synced_at'])

        if not group.price_sync_enabled:
            logger.info(f"[Pricing] Group '{group.name}' has sync disabled, skipping member update")
            return {'synced': 0, 'mode': 'disabled'}

        mode = getattr(group, 'pricing_mode', 'FIXED') or 'FIXED'
        base_ttc = group.base_selling_price_ttc or Decimal('0.00')
        rounding = getattr(group, 'rounding_rule', 'NONE') or 'NONE'
        margin_floor = Decimal(str(getattr(group, 'margin_floor_pct', 0) or 0))

        members = Product.objects.filter(
            product_group=group,
            organization=group.organization,
        )
        synced = 0
        broken = 0
        skipped = 0

        for product in members:
            cost = product.cost_price or product.cost_price_ttc or Decimal('0.00')
            target_price = None

            if mode == 'FIXED':
                target_price = base_ttc

            elif mode == 'MARGIN_RULE':
                margin_pct = Decimal(str(getattr(group, 'margin_rule_pct', 0) or 0))
                if margin_pct > 0 and cost > 0:
                    # selling = cost / (1 - margin/100)
                    factor = Decimal('1') - (margin_pct / Decimal('100'))
                    if factor > 0:
                        target_price = cost / factor
                    else:
                        target_price = cost  # fallback: 100%+ margin is invalid
                else:
                    target_price = base_ttc  # fallback to base

            elif mode == 'CEILING':
                # Product keeps its current price unless it exceeds ceiling
                current = product.selling_price_ttc or Decimal('0.00')
                target_price = min(current, base_ttc) if current > 0 else base_ttc

            elif mode == 'BAND':
                # Lookup from price_band_values JSON: {"0-1000": 500, "1000-5000": 450, ...}
                bands = getattr(group, 'price_band_values', None) or {}
                target_price = base_ttc  # default fallback
                cost_f = float(cost)
                for band_key, band_price in bands.items():
                    if '-' in str(band_key):
                        parts = str(band_key).split('-')
                        try:
                            lo, hi = float(parts[0]), float(parts[1])
                            if lo <= cost_f < hi:
                                target_price = Decimal(str(band_price))
                                break
                        except (ValueError, IndexError):
                            continue

            elif mode == 'MANUAL':
                # Don't change prices, just mark pending
                product.group_sync_status = 'PENDING'
                product.group_expected_price = base_ttc
                product.save(update_fields=['group_sync_status', 'group_expected_price'])
                skipped += 1
                continue

            # Apply rounding
            if target_price is not None:
                target_price = ProductGroupPricingService._apply_rounding(target_price, rounding)

                # Margin floor guard — reject if margin drops below floor
                if margin_floor > 0 and cost > 0:
                    actual_margin = ((target_price - cost) / target_price) * 100
                    if actual_margin < margin_floor:
                        product.group_sync_status = 'BROKEN'
                        product.group_broken_since = product.group_broken_since or timezone.now()
                        product.group_expected_price = target_price
                        product.save(update_fields=[
                            'group_sync_status', 'group_broken_since', 'group_expected_price'
                        ])
                        broken += 1
                        logger.warning(
                            f"[Pricing] Product '{product.sku}' margin {actual_margin:.1f}% < floor {margin_floor}%, marked BROKEN"
                        )
                        continue

                # Apply price
                product.selling_price_ttc = target_price
                product.group_sync_status = 'SYNCED'
                product.group_broken_since = None
                product.group_expected_price = target_price
                product.pricing_source = 'GROUP'
                product.updated_at = timezone.now()
                product.save(update_fields=[
                    'selling_price_ttc', 'group_sync_status', 'group_broken_since',
                    'group_expected_price', 'pricing_source', 'updated_at',
                ])

                # Recalculate packaging formulas
                ProductGroupPricingService.apply_packaging_formula(product, group)
                synced += 1

        logger.info(
            f"[Pricing] Synced group '{group.name}' mode={mode}: {synced} synced, {broken} broken, {skipped} manual"
        )
        return {
            'synced': synced,
            'broken': broken,
            'skipped': skipped,
            'mode': mode,
            'base_price_ttc': str(base_ttc),
        }

    @staticmethod
    def apply_packaging_formula(product, group=None):
        """
        Level 2: Recalculate packaging-level prices using FORMULA mode.
        Skips levels with FIXED price_mode.
        
        Args:
            product: Product instance
            group: Optional ProductGroup (fetched from product if not provided)
        """
        from apps.inventory.models import ProductPackaging

        if group is None:
            group = product.product_group

        base_price = product.selling_price_ttc or Decimal('0.00')
        packaging_levels = ProductPackaging.objects.filter(
            product=product, price_mode='FORMULA'
        )

        updated = 0
        for pkg in packaging_levels:
            # Check if group has a formula override for this packaging unit
            group_discount = Decimal('0.00')
            if group and group.packaging_formula:
                unit_name = pkg.unit.name if pkg.unit else ''
                unit_code = pkg.unit.code if pkg.unit else ''
                # Match by unit name or code in the formula JSON
                for key in [unit_name, unit_code, str(pkg.level)]:
                    if key in group.packaging_formula:
                        group_discount = Decimal(str(
                            group.packaging_formula[key].get('discount_pct', 0)
                        ))
                        break

            # Use per-level discount or group formula discount
            discount = pkg.discount_pct if pkg.discount_pct > 0 else group_discount
            discount_factor = Decimal('1') - (discount / Decimal('100'))
            calculated_price = (base_price * pkg.ratio * discount_factor).quantize(TWO_PLACES, ROUND_HALF_UP)

            if pkg.custom_selling_price != calculated_price:
                pkg.custom_selling_price = calculated_price
                pkg.save(update_fields=['custom_selling_price'])
                updated += 1

        logger.info(f"[Pricing] Recalculated {updated} packaging levels for product '{product.name}'")
        return {'updated': updated}

    @staticmethod
    def get_resolved_price(product, packaging_level=None, contact=None, quantity=1):
        """
        Resolve the final selling price through all 3 levels.
        
        Resolution order (first match wins):
          1. ClientPriceRule (contact-specific)
          2. ClientPriceRule (price_group match)
          3. ClientPriceRule (customer_tier match)
          4. ProductPackaging.effective_selling_price
          5. ProductGroup.base_selling_price_ttc
          6. Product.selling_price_ttc
        
        Args:
            product: Product instance
            packaging_level: Optional ProductPackaging instance
            contact: Optional Contact instance
            quantity: Order quantity (for min_quantity rules)
            
        Returns:
            dict with resolved_price, source, and rule details
        """
        from django.utils import timezone as tz

        base_price = product.selling_price_ttc or Decimal('0.00')

        # --- Level 5: Product Group base price ---
        if product.product_group and product.product_group.base_selling_price_ttc:
            base_price = product.product_group.base_selling_price_ttc

        # --- Level 4: Packaging formula/fixed ---
        if packaging_level:
            packaging_price = packaging_level.effective_selling_price
            if packaging_price and packaging_price > 0:
                base_price = packaging_price

        # --- Level 3/2/1: Client/Tier pricing ---
        if contact:
            resolved = ProductGroupPricingService._resolve_client_price(
                product, packaging_level, contact, quantity, base_price
            )
            if resolved:
                return resolved

        return {
            'resolved_price': base_price,
            'source': 'packaging' if packaging_level else ('group' if product.product_group else 'product'),
            'rule': None
        }

    @staticmethod
    def _resolve_client_price(product, packaging_level, contact, quantity, base_price):
        """
        Check ClientPriceRule in priority order:
          1. Contact-specific rules
          2. PriceGroup rules (by priority)
          3. Tier-level rules
        """
        ClientPriceRule = connector.require('crm.pricing.get_client_price_rule_model', org_id=0, source='inventory')
        PriceGroupMember = connector.require('crm.pricing.get_price_group_member_model', org_id=0, source='inventory')
        if not ClientPriceRule:
            return None
        from django.utils import timezone as tz

        today = tz.now().date()

        # Build base filter
        base_filter = {
            'organization': product.organization,
            'is_active': True,
            'min_quantity__lte': quantity,
        }

        # 1. Contact-specific rules
        rules = ClientPriceRule.objects.filter(
            **base_filter,
            contact_id=contact.id,
        ).order_by('-updated_at')

        result = ProductGroupPricingService._match_rule(
            rules, product, packaging_level, base_price, today
        )
        if result:
            result['source'] = 'client_specific'
            return result

        # 2. PriceGroup rules
        member_group_ids = PriceGroupMember.objects.filter(
            organization=product.organization,
            contact_id=contact.id
        ).values_list('price_group_id', flat=True)

        if member_group_ids:
            rules = ClientPriceRule.objects.filter(
                **base_filter,
                price_group_id__in=member_group_ids,
                contact_id__isnull=True,
            ).select_related('price_group').order_by('-price_group__priority', '-updated_at')

            result = ProductGroupPricingService._match_rule(
                rules, product, packaging_level, base_price, today
            )
            if result:
                result['source'] = 'price_group'
                return result

        # 3. Tier-level rules — match via customer_tier
        # (Tier rules use price_group with matching name)
        if hasattr(contact, 'customer_tier') and contact.customer_tier:
            PriceGroup = connector.require('crm.pricing.get_price_group_model', org_id=0, source='inventory')
            if not PriceGroup:
                raise ValueError('CRM module is required.')
            tier_groups = PriceGroup.objects.filter(
                organization=product.organization,
                name__iexact=contact.customer_tier,
                is_active=True
            ).values_list('id', flat=True)

            if tier_groups:
                rules = ClientPriceRule.objects.filter(
                    **base_filter,
                    price_group_id__in=tier_groups,
                    contact_id__isnull=True,
                ).order_by('-updated_at')

                result = ProductGroupPricingService._match_rule(
                    rules, product, packaging_level, base_price, today
                )
                if result:
                    result['source'] = 'tier'
                    return result

        return None

    @staticmethod
    def _match_rule(rules, product, packaging_level, base_price, today):
        """Find the first matching rule and apply it."""
        for rule in rules:
            # Check validity dates
            if rule.valid_from and rule.valid_from > today:
                continue
            if rule.valid_until and rule.valid_until < today:
                continue

            # Check product scope
            if rule.product_id and rule.product_id != product.id:
                continue
            if rule.category_id and rule.category_id != (product.category_id or 0):
                continue
            if rule.product_group_id and rule.product_group_id != (product.product_group_id or 0):
                continue

            # Check packaging level scope
            if rule.packaging_level_id:
                if not packaging_level or rule.packaging_level_id != packaging_level.id:
                    continue

            # Apply the discount
            resolved = ProductGroupPricingService._apply_rule(rule, base_price)
            return {
                'resolved_price': resolved,
                'rule_id': rule.id,
                'rule_type': rule.discount_type,
                'rule_value': str(rule.value),
            }

        return None

    @staticmethod
    def _apply_rule(rule, base_price):
        """Apply a ClientPriceRule to a base price."""
        if rule.discount_type == 'FIXED_PRICE':
            return rule.value
        elif rule.discount_type == 'PERCENTAGE':
            discount = base_price * (rule.value / Decimal('100'))
            return (base_price - discount).quantize(TWO_PLACES, ROUND_HALF_UP)
        elif rule.discount_type == 'AMOUNT_OFF':
            return max(Decimal('0.00'), base_price - rule.value)
        return base_price
