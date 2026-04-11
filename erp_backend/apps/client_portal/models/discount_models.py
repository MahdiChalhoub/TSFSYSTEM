"""
Coupon & Discount Engine
=========================
Generic coupon system for eCommerce storefronts.
Works across all store modes (B2C, B2B, HYBRID).

Models:
  Coupon      — defines the discount rule
  CouponUsage — audit trail of per-order usage
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from erp.models import TenantModel


class Coupon(TenantModel):
    """
    A reusable discount code.

    Discount types:
      PERCENT  — deducts N% from order subtotal (capped at subtotal)
      FIXED    — deducts a fixed amount in the order's currency
    """
    DISCOUNT_TYPES = (
        ('PERCENT', 'Percentage Discount'),
        ('FIXED', 'Fixed Amount Discount'),
    )

    code = models.CharField(max_length=50)
    description = models.CharField(max_length=255, blank=True, default='')

    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPES, default='PERCENT')
    value = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Percentage (e.g. 25 for 25%) or fixed amount in org currency"
    )

    # Constraints
    min_order_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text="Minimum subtotal required to apply this coupon"
    )
    max_discount_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text="Cap the discount at this amount (optional)"
    )

    # Usage limits
    max_uses = models.IntegerField(
        null=True, blank=True,
        help_text="Total uses allowed. Leave blank for unlimited."
    )
    used_count = models.IntegerField(default=0)
    one_per_customer = models.BooleanField(
        default=False,
        help_text="Each customer can only use this coupon once"
    )

    # Validity window
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_coupon'
        unique_together = [('organization', 'code')]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} ({self.get_discount_type_display()}: {self.value})"

    # ── Validation ────────────────────────────────────────────────────────

    def is_valid(self, order_subtotal: Decimal, contact=None) -> tuple[bool, str]:
        """
        Check if this coupon can be applied to an order.

        Returns:
            (True, '')          — coupon is valid
            (False, reason)     — coupon is not valid, with reason string
        """
        now = timezone.now()

        if not self.is_active:
            return False, "This coupon is no longer active."

        if self.valid_from and now < self.valid_from:
            return False, f"This coupon is not yet valid (valid from {self.valid_from.strftime('%Y-%m-%d')})."

        if self.valid_until and now > self.valid_until:
            return False, "This coupon has expired."

        if self.max_uses is not None and self.used_count >= self.max_uses:
            return False, "This coupon has reached its usage limit."

        if order_subtotal < self.min_order_amount:
            return False, f"Minimum order amount of {self.min_order_amount} required to use this coupon."

        if self.one_per_customer and contact:
            already_used = CouponUsage.objects.filter(
                coupon=self, contact=contact
            ).exists()
            if already_used:
                return False, "You have already used this coupon."

        return True, ""

    # ── Calculation ───────────────────────────────────────────────────────

    def calculate_discount(self, subtotal: Decimal) -> Decimal:
        """
        Compute the discount amount for the given subtotal.

        Returns:
            Decimal — amount to subtract from the order total
        """
        if self.discount_type == 'PERCENT':
            discount = subtotal * (self.value / Decimal('100'))
        else:
            discount = self.value

        # Cap at subtotal (can't discount more than order value)
        discount = min(discount, subtotal)

        # Apply max cap if set
        if self.max_discount_amount:
            discount = min(discount, self.max_discount_amount)

        return discount.quantize(Decimal('0.01'))


class CouponUsage(TenantModel):
    """
    Records each time a coupon is applied to an order.
    Used for max_uses tracking and one_per_customer enforcement.
    """
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    contact = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='coupon_usages'
    )
    order = models.ForeignKey(
        'client_portal.ClientOrder', on_delete=models.CASCADE,
        related_name='coupon_usages'
    )
    discount_applied = models.DecimalField(max_digits=15, decimal_places=2)
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'client_coupon_usage'
        ordering = ['-used_at']

    def __str__(self):
        return f"{self.coupon.code} → Order {self.order.order_number} (-{self.discount_applied})"
