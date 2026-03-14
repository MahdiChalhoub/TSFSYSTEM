"""
eCommerce Shipping Service
===========================
Calculates delivery fees and returns available shipping options for an order.

The resolver walks ShippingRate tiers linked to each DeliveryZone and finds
the best matching tier. Falls back to DeliveryZone.base_fee if no tier matches.

Usage:
    from apps.client_portal.shipping_service import ShippingService

    # Get all available options (for checkout shipping selection UI)
    options = ShippingService.get_available_methods(
        organization=order.organization,
        order_subtotal=order.subtotal,
        total_weight_kg=Decimal('1.5'),
    )
    # → [{ zone_id, zone_name, fee, estimated_days, is_free }, ...]

    # Get exact fee for a chosen zone
    fee = ShippingService.calculate_rate(
        zone_id=3,
        organization=order.organization,
        order_subtotal=order.subtotal,
        total_weight_kg=Decimal('1.5'),
    )
"""
import logging
from decimal import Decimal
from erp.connector_registry import connector

logger = logging.getLogger('client_portal.shipping')


class ShippingService:

    @staticmethod
    def get_available_methods(
        organization,
        order_subtotal: Decimal,
        total_weight_kg: Decimal = Decimal('0'),
        contact=None,
    ) -> list:
        """
        Returns all active delivery zones for this org with computed fees.

        Args:
            organization:      erp.Organization
            order_subtotal:    cart subtotal (before delivery) as Decimal
            total_weight_kg:   combined weight of all cart lines
            contact:           crm.Contact or None (unused currently, reserved)

        Returns:
            list of dicts, sorted ascending by fee:
            [
              {
                'zone_id': 3,
                'zone_name': 'Abidjan Centre',
                'fee': Decimal('500.00'),
                'estimated_days': 1,
                'is_free': False,
              },
              ...
            ]
        """
        DeliveryZone = connector.require('pos.delivery_zones.get_model', org_id=0, source='client_portal')
        if not DeliveryZone:
            raise ValueError('POS module is required.')

        zones = DeliveryZone.objects.filter(
            organization=organization,
            is_active=True,
        ).prefetch_related('shipping_rates')

        results = []
        for zone in zones:
            fee, days = ShippingService._resolve_tier(zone, order_subtotal, total_weight_kg)
            results.append({
                'zone_id': zone.id,
                'zone_name': zone.name,
                'fee': fee,
                'estimated_days': days,
                'is_free': fee == Decimal('0.00'),
            })

        return sorted(results, key=lambda r: r['fee'])

    @staticmethod
    def calculate_rate(
        zone_id: int,
        organization,
        order_subtotal: Decimal,
        total_weight_kg: Decimal = Decimal('0'),
    ) -> Decimal:
        """
        Returns the exact shipping fee for a specific zone + order.

        Raises ValueError if the zone does not belong to this organization.
        """
        DeliveryZone = connector.require('pos.delivery_zones.get_model', org_id=0, source='client_portal')
        if not DeliveryZone:
            raise ValueError('POS module is required.')

        try:
            zone = DeliveryZone.objects.prefetch_related('shipping_rates').get(
                id=zone_id,
                organization=organization,
                is_active=True,
            )
        except DeliveryZone.DoesNotExist:
            raise ValueError(f"Delivery zone #{zone_id} not found or inactive.")

        fee, _ = ShippingService._resolve_tier(zone, order_subtotal, total_weight_kg)
        return fee

    @staticmethod
    def _resolve_tier(zone, order_subtotal: Decimal, total_weight_kg: Decimal):
        """
        Find the matching ShippingRate tier for this zone + order.

        Returns:
            (fee: Decimal, estimated_days: int)
        """
        from apps.client_portal.models.shipping_models import ShippingRate

        tiers = ShippingRate.objects.filter(
            zone=zone,
            organization=zone.organization,
            is_active=True,
        ).order_by('sort_order', 'min_order_value')

        for tier in tiers:
            if tier.matches(order_subtotal, total_weight_kg):
                days = tier.estimated_days if tier.estimated_days is not None else zone.estimated_days
                logger.debug(
                    f"[Shipping] Zone '{zone.name}': tier matched "
                    f"(subtotal={order_subtotal}, weight={total_weight_kg}) → fee={tier.fee}"
                )
                return tier.fee, days

        # No tier matched — use zone base fee
        logger.debug(f"[Shipping] Zone '{zone.name}': no tier matched, using base_fee={zone.base_fee}")
        return zone.base_fee, zone.estimated_days

    @staticmethod
    def get_cart_weight(order) -> Decimal:
        """
        Estimate total cart weight from product weights (if available).
        Falls back to 0 if products don't have a weight field.
        """
        total = Decimal('0')
        for line in order.lines.select_related('product').all():
            if line.product and hasattr(line.product, 'weight_kg') and line.product.weight_kg:
                total += Decimal(str(line.product.weight_kg)) * line.quantity
        return total
