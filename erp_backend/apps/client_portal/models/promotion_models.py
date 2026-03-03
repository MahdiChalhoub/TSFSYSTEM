"""
eCommerce Promotions Models
============================
Cart-level automatic promotions evaluated at place_order time.
No coupon code required — promotions fire automatically when conditions are met.

Rule types:
  SPEND_THRESHOLD — spend >= X → get Y% (or flat amount) off the whole cart
  BOGO            — buy X qty of product P → get Y units of P free (price 0)
  BUNDLE          — buy products A and B → get Z% off the cart total
  MIN_QUANTITY    — buy >= N of product P → get X% off that product's lines

Evaluation: PromotionService.evaluate_cart(order) → apply highest-priority
non-stackable promo, or all stackable promos.
"""
from decimal import Decimal
from django.db import models
from erp.models import TenantModel


class CartPromotion(TenantModel):
    """
    Automatic cart-level promotion rule.
    """
    RULE_TYPES = [
        ('SPEND_THRESHOLD', 'Spend Threshold — spend X → get discount'),
        ('BOGO',            'Buy X Get Y Free'),
        ('BUNDLE',          'Bundle — buy products A+B → get discount'),
        ('MIN_QUANTITY',    'Min Quantity — buy N of a product → get discount'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    rule_type = models.CharField(max_length=20, choices=RULE_TYPES)

    # Rule conditions and rewards stored as JSON for flexibility
    conditions = models.JSONField(
        help_text="""Rule-specific conditions. Examples:
          SPEND_THRESHOLD: {"min_subtotal": 50000}
          BOGO:            {"product_id": 42, "buy_quantity": 2}
          BUNDLE:          {"product_ids": [42, 55]}
          MIN_QUANTITY:    {"product_id": 42, "min_quantity": 5}"""
    )
    reward = models.JSONField(
        help_text="""Discount to apply when conditions are met. Examples:
          {"type": "PERCENT_OFF_CART",   "value": 10}
          {"type": "FIXED_OFF_CART",     "value": 5000}
          {"type": "FREE_QUANTITY",      "product_id": 42, "free_quantity": 1}
          {"type": "PERCENT_OFF_LINE",   "value": 20}"""
    )

    priority = models.IntegerField(
        default=0,
        help_text='Higher value = evaluated first. Only highest-priority non-stackable promo applies.',
    )
    stackable = models.BooleanField(
        default=False,
        help_text='If True, this promo can combine with other promotions on the same order.',
    )
    max_uses = models.IntegerField(
        null=True, blank=True,
        help_text='Total uses allowed across all customers. Null = unlimited.',
    )
    used_count = models.IntegerField(default=0)
    one_per_customer = models.BooleanField(
        default=False,
        help_text='Each customer can only benefit from this promotion once.',
    )

    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cart_promotion'
        ordering = ['-priority', '-created_at']

    def __str__(self):
        return f"[{self.rule_type}] {self.name}"


class CartPromotionUsage(TenantModel):
    """
    Audit trail recording which promotions were applied to which orders.
    """
    promotion = models.ForeignKey(
        CartPromotion,
        on_delete=models.CASCADE,
        related_name='usages',
    )
    order = models.ForeignKey(
        'client_portal.ClientOrder',
        on_delete=models.CASCADE,
        related_name='promotion_usages',
    )
    contact = models.ForeignKey(
        'crm.Contact',
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='promotion_usages',
    )
    discount_applied = models.DecimalField(max_digits=15, decimal_places=2)
    applied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cart_promotion_usage'
        ordering = ['-applied_at']

    def __str__(self):
        return f"[{self.promotion.name}] Order #{self.order.order_number}: -{self.discount_applied}"
