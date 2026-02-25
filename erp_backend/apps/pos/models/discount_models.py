"""
Discount Rule Engine Models
Configurable discount rules that can be auto-applied at POS checkout.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User


class DiscountRule(TenantModel):
    """A configurable discount rule that can apply to products, categories, or orders."""
    TYPE_CHOICES = (
        ('PERCENTAGE', 'Percentage Off'),
        ('FIXED', 'Fixed Amount Off'),
        ('BUY_X_GET_Y', 'Buy X Get Y Free'),
    )
    SCOPE_CHOICES = (
        ('ORDER', 'Entire Order'),
        ('PRODUCT', 'Specific Product'),
        ('CATEGORY', 'Product Category'),
        ('BRAND', 'Product Brand'),
    )

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, null=True, blank=True, help_text='Promo code for manual entry')
    discount_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='PERCENTAGE')
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='ORDER')
    value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                help_text='% for PERCENTAGE, amount for FIXED, X for BUY_X_GET_Y')
    max_discount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True,
                                       help_text='Cap for percentage discounts')
    min_order_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True,
                                           help_text='Minimum order total to qualify')
    min_quantity = models.PositiveIntegerField(null=True, blank=True,
                                               help_text='Minimum item quantity to qualify')

    # Scope targets
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, null=True, blank=True)
    category = models.ForeignKey('inventory.Category', on_delete=models.CASCADE, null=True, blank=True)
    brand = models.ForeignKey('inventory.Brand', on_delete=models.CASCADE, null=True, blank=True)

    # Validity
    is_active = models.BooleanField(default=True)
    auto_apply = models.BooleanField(default=False, help_text='Automatically apply at checkout')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text='Max times this rule can be used')
    times_used = models.PositiveIntegerField(default=0)

    priority = models.PositiveIntegerField(default=0, help_text='Higher = applied first')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'pos_discount_rule'
        ordering = ['-priority', '-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_discount_type_display()})"

    @property
    def is_valid(self):
        from django.utils import timezone
        today = timezone.now().date()
        if not self.is_active:
            return False
        if self.start_date and today < self.start_date:
            return False
        if self.end_date and today > self.end_date:
            return False
        if self.usage_limit and self.times_used >= self.usage_limit:
            return False
        return True


class DiscountUsageLog(TenantModel):
    """Tracks each time a discount rule is applied."""
    rule = models.ForeignKey(DiscountRule, on_delete=models.CASCADE, related_name='usage_logs')
    order = models.ForeignKey('pos.Order', on_delete=models.CASCADE, related_name='discount_logs')
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2)
    applied_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    applied_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'pos_discount_usage_log'
        ordering = ['-applied_at']

    def __str__(self):
        return f"{self.rule.name} → Order#{self.order_id} ({self.discount_amount})"
