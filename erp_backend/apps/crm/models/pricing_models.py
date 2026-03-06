"""
CRM Pricing Models — Client-Specific Pricing
Enables per-client, per-tier, and per-group price rules for products.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class PriceGroup(TenantModel):
    """
    Named pricing group. Contacts can belong to groups (e.g., VIP, Wholesale, Seasonal).
    Products can have different prices per group.
    """
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    priority = models.IntegerField(
        default=0,
        help_text='Higher priority groups override lower ones when a contact belongs to multiple groups'
    )
    is_active = models.BooleanField(default=True)
    valid_from = models.DateField(null=True, blank=True, help_text='Optional start date for time-limited pricing')
    valid_until = models.DateField(null=True, blank=True, help_text='Optional end date for time-limited pricing')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'price_group'
        ordering = ['-priority', 'name']

    def __str__(self):
        return self.name


class PriceGroupMember(TenantModel):
    """
    Assigns a Contact to a PriceGroup.
    A contact can belong to multiple groups; the highest-priority group wins.
    """
    price_group = models.ForeignKey(
        PriceGroup, on_delete=models.CASCADE, related_name='members'
    )
    # Decoupled FK — avoids hard import of Contact to allow flexibility
    contact_id = models.IntegerField(db_column='contact_id')
    joined_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'price_group_member'
        unique_together = ('price_group', 'contact_id', 'organization')

    def __str__(self):
        return f"Contact #{self.contact_id} → {self.price_group.name}"


class ClientPriceRule(TenantModel):
    """
    Individual price override for a specific product-contact or product-group combination.
    Either contact_id OR price_group must be set (not both).
    """
    DISCOUNT_TYPES = (
        ('FIXED_PRICE', 'Fixed Price Override'),
        ('PERCENTAGE', 'Percentage Discount'),
        ('AMOUNT_OFF', 'Fixed Amount Off'),
    )

    # Target: specific contact OR price group (one of the two)
    contact_id = models.IntegerField(
        null=True, blank=True, db_column='contact_id',
        help_text='Specific contact this rule applies to'
    )
    price_group = models.ForeignKey(
        PriceGroup, on_delete=models.CASCADE, null=True, blank=True,
        related_name='price_rules',
        help_text='Price group this rule applies to'
    )

    # Product scope
    product_id = models.IntegerField(
        null=True, blank=True, db_column='product_id',
        help_text='Specific product (null = applies to all products)'
    )
    # Category-level pricing (if product_id is null)
    category_id = models.IntegerField(
        null=True, blank=True, db_column='category_id',
        help_text='Product category (null = all categories)'
    )
    # Product group scope — apply rule to all products in a group
    product_group_id = models.IntegerField(
        null=True, blank=True, db_column='product_group_id',
        help_text='Product group (null = not group-scoped)'
    )
    # Packaging level scope — apply rule to a specific packaging level
    packaging_level_id = models.IntegerField(
        null=True, blank=True, db_column='packaging_level_id',
        help_text='Packaging level (null = base unit price)'
    )

    # Pricing rule
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES, default='FIXED_PRICE')
    value = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Price value: fixed price, percentage, or amount off'
    )
    min_quantity = models.IntegerField(
        default=1, help_text='Minimum quantity for this rule to apply'
    )

    # Validity
    is_active = models.BooleanField(default=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)

    # Metadata
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'client_price_rule'
        ordering = ['-is_active', 'discount_type']

    def __str__(self):
        target = f"Contact #{self.contact_id}" if self.contact_id else f"Group: {self.price_group}"
        scope = f"Product #{self.product_id}" if self.product_id else "All Products"
        return f"{target} → {scope}: {self.discount_type} {self.value}"
