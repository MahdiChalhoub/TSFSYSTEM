"""
CRM Loyalty Service
====================
Points-based loyalty system with configurable earn rates,
point redemption, and automatic tier calculation.
"""
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class LoyaltyService:
    """
    Loyalty program engine for customer contacts.

    Tier Thresholds (configurable):
        STANDARD:  lifetime_value < 5,000
        VIP:       lifetime_value >= 5,000
        WHOLESALE: lifetime_value >= 50,000

    Points:
        Earn: 1 point per 10 currency units spent (configurable)
        Burn: 100 points = 1 currency unit discount
    """

    # Default configuration (can be overridden via org settings)
    EARN_RATE = Decimal('0.1')       # Points per currency unit (1 point per 10 units)
    BURN_RATE = Decimal('0.01')      # Currency units per point (100 points = 1 unit)
    
    TIER_THRESHOLDS = {
        'STANDARD': Decimal('0'),
        'VIP': Decimal('5000'),
        'WHOLESALE': Decimal('50000'),
    }

    @staticmethod
    def earn_points(contact, order_total):
        """
        Award loyalty points based on order total.
        Automatically recalculates tier.

        Args:
            contact: Contact instance (CUSTOMER type)
            order_total: Decimal order amount

        Returns:
            dict with points_earned, new_total, tier
        """
        from django.utils import timezone

        points_earned = int(order_total * LoyaltyService.EARN_RATE)
        if points_earned <= 0:
            return {'points_earned': 0, 'new_total': contact.loyalty_points, 'tier': contact.customer_tier}

        contact.loyalty_points += points_earned
        contact.total_orders += 1
        contact.lifetime_value += Decimal(str(order_total))
        contact.last_purchase_date = timezone.now()

        if not contact.first_purchase_date:
            contact.first_purchase_date = timezone.now()

        contact.recalculate_analytics()

        # Auto-tier
        new_tier = LoyaltyService.calculate_tier(contact.lifetime_value)
        contact.customer_tier = new_tier

        contact.save(update_fields=[
            'loyalty_points', 'total_orders', 'lifetime_value',
            'average_order_value', 'last_purchase_date', 'first_purchase_date',
            'customer_tier',
        ])

        logger.info(f"[Loyalty] {contact.name}: +{points_earned} pts, total={contact.loyalty_points}, tier={new_tier}")

        return {
            'points_earned': points_earned,
            'new_total': contact.loyalty_points,
            'tier': new_tier,
        }

    @staticmethod
    def burn_points(contact, points_to_burn):
        """
        Redeem loyalty points for a discount.

        Args:
            contact: Contact instance
            points_to_burn: Number of points to redeem

        Returns:
            dict with discount_amount, remaining_points
        """
        if points_to_burn <= 0:
            return {'discount_amount': Decimal('0.00'), 'remaining_points': contact.loyalty_points}

        if points_to_burn > contact.loyalty_points:
            return {'error': f'Insufficient points. Have {contact.loyalty_points}, need {points_to_burn}'}

        discount = Decimal(str(points_to_burn)) * LoyaltyService.BURN_RATE
        contact.loyalty_points -= points_to_burn
        contact.save(update_fields=['loyalty_points'])

        logger.info(f"[Loyalty] {contact.name}: -{points_to_burn} pts = {discount} discount")

        return {
            'discount_amount': float(discount),
            'remaining_points': contact.loyalty_points,
        }

    @staticmethod
    def calculate_tier(lifetime_value):
        """Determine tier based on lifetime value."""
        if lifetime_value >= LoyaltyService.TIER_THRESHOLDS['WHOLESALE']:
            return 'WHOLESALE'
        elif lifetime_value >= LoyaltyService.TIER_THRESHOLDS['VIP']:
            return 'VIP'
        else:
            return 'STANDARD'

    @staticmethod
    def get_customer_analytics(contact):
        """Return analytics summary for a customer contact."""
        return {
            'name': contact.name,
            'tier': contact.customer_tier,
            'loyalty_points': contact.loyalty_points,
            'total_orders': contact.total_orders,
            'lifetime_value': float(contact.lifetime_value),
            'average_order_value': float(contact.average_order_value),
            'first_purchase': contact.first_purchase_date.isoformat() if contact.first_purchase_date else None,
            'last_purchase': contact.last_purchase_date.isoformat() if contact.last_purchase_date else None,
            'points_value': float(Decimal(str(contact.loyalty_points)) * LoyaltyService.BURN_RATE),
        }

    @staticmethod
    def rate_supplier(contact, quality=None, delivery=None, pricing=None, service=None):
        """
        Submit a supplier rating (1-5 scale).
        Recalculates overall weighted average.
        """
        if quality is not None:
            # Running average
            contact.quality_rating = _running_avg(contact.quality_rating, quality, contact.total_ratings)
        if delivery is not None:
            contact.delivery_rating = _running_avg(contact.delivery_rating, delivery, contact.total_ratings)
        if pricing is not None:
            contact.pricing_rating = _running_avg(contact.pricing_rating, pricing, contact.total_ratings)
        if service is not None:
            contact.service_rating = _running_avg(contact.service_rating, service, contact.total_ratings)

        contact.total_ratings += 1
        contact.recalculate_supplier_rating()

        contact.save(update_fields=[
            'quality_rating', 'delivery_rating', 'pricing_rating',
            'service_rating', 'total_ratings', 'overall_rating',
        ])

        return {
            'overall_rating': float(contact.overall_rating),
            'total_ratings': contact.total_ratings,
        }

    @staticmethod
    def record_delivery(contact, on_time=True, lead_time_days=None):
        """Record a delivery event for supplier performance tracking."""
        contact.supplier_total_orders += 1
        if on_time:
            contact.on_time_deliveries += 1
        else:
            contact.late_deliveries += 1

        if lead_time_days is not None:
            # Running average
            old_avg = float(contact.avg_lead_time_days)
            n = contact.supplier_total_orders
            new_avg = old_avg + (lead_time_days - old_avg) / n
            contact.avg_lead_time_days = Decimal(str(round(new_avg, 1)))

        contact.save(update_fields=[
            'supplier_total_orders', 'on_time_deliveries',
            'late_deliveries', 'avg_lead_time_days',
        ])

    @staticmethod
    def get_supplier_scorecard(contact):
        """Return performance scorecard for a supplier contact."""
        total = contact.supplier_total_orders
        delivery_pct = (contact.on_time_deliveries / total * 100) if total > 0 else 0

        return {
            'name': contact.name,
            'overall_rating': float(contact.overall_rating),
            'quality_rating': float(contact.quality_rating),
            'delivery_rating': float(contact.delivery_rating),
            'pricing_rating': float(contact.pricing_rating),
            'service_rating': float(contact.service_rating),
            'total_ratings': contact.total_ratings,
            'total_orders': total,
            'on_time_pct': round(delivery_pct, 1),
            'on_time': contact.on_time_deliveries,
            'late': contact.late_deliveries,
            'total_purchase_amount': float(contact.total_purchase_amount),
            'avg_lead_time_days': float(contact.avg_lead_time_days),
        }


def _running_avg(old_avg, new_val, count):
    """Compute running average."""
    if count == 0:
        return Decimal(str(new_val))
    old = float(old_avg)
    new = old + (float(new_val) - old) / (count + 1)
    return Decimal(str(round(new, 1)))
