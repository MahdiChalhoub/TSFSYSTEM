"""
eCommerce Shipping Models
==========================
Extends the POS DeliveryZone model with eCommerce-specific rate tiers.

A ShippingRate defines the fee for a zone within a specific order value
and/or weight range. When a customer checks out, ShippingService evaluates
which rate tier applies and returns fee + estimated_days.

Examples:
  Zone: "Abidjan Centre"  base_fee=500
    Rate 1: order < 10,000 XOF → fee=1,500 XOF
    Rate 2: order >= 10,000 XOF → fee=0 (free shipping)

  Zone: "Bouaké"         base_fee=2,500
    Rate 1: weight < 2kg → fee=2,500 XOF
    Rate 2: weight 2-5kg → fee=5,000 XOF
    Rate 3: weight > 5kg → fee=8,000 XOF
"""
from decimal import Decimal
from django.db import models
from erp.models import TenantModel


class ShippingRate(TenantModel):
    """
    A price tier for a specific DeliveryZone.

    Resolution logic (in ShippingService):
      - Find all active ShippingRate records for this zone + org
      - Filter where order_subtotal is within [min_order_value, max_order_value]
        AND total_weight_kg is within [min_weight_kg, max_weight_kg]
      - Use the matching tier's fee; if none match, fall back to zone.base_fee
    """
    zone = models.ForeignKey(
        'pos.DeliveryZone',
        on_delete=models.CASCADE,
        related_name='shipping_rates',
        help_text='The delivery zone this rate tier belongs to',
    )

    # Order value range (both optional for a flat unconditional rate)
    min_order_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Minimum order subtotal for this tier to apply (inclusive)',
    )
    max_order_value = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Maximum order subtotal (exclusive). Null = no ceiling.',
    )

    # Weight range (0 / null = no weight restriction)
    min_weight_kg = models.DecimalField(
        max_digits=10, decimal_places=3, default=Decimal('0.000'),
        help_text='Minimum cart weight in kg (inclusive)',
    )
    max_weight_kg = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True,
        help_text='Maximum cart weight in kg (exclusive). Null = no ceiling.',
    )

    fee = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Shipping fee for orders matching this tier',
    )
    estimated_days = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Override zone.estimated_days for this specific tier',
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(
        default=0,
        help_text='Lower number = evaluated first when multiple tiers match',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ecommerce_shipping_rate'
        ordering = ['sort_order', 'min_order_value']

    def __str__(self):
        tier = f"≥{self.min_order_value}"
        if self.max_order_value:
            tier += f" & <{self.max_order_value}"
        return f"[{self.zone.name}] {tier} → {self.fee}"

    def matches(self, order_subtotal: Decimal, weight_kg: Decimal = Decimal('0')) -> bool:
        """True if this tier applies to the given order."""
        if not self.is_active:
            return False
        if order_subtotal < self.min_order_value:
            return False
        if self.max_order_value is not None and order_subtotal >= self.max_order_value:
            return False
        if weight_kg < self.min_weight_kg:
            return False
        if self.max_weight_kg is not None and weight_kg >= self.max_weight_kg:
            return False
        return True
