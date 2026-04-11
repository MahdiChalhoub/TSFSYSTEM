"""
Weighted / Fresh Product Policy — governs variable-weight barcode generation,
kg-based labeling, and fresh product lifecycle.

Fresh/variable-weight products have special barcode structures:
- Prefix encodes "price-embedded" (EAN-13 prefix 2X where X=category)
- Digits 7-11 encode the weight or price
- Checksum digit at position 13

These products also need:
- Tare weight management
- Shelf-life tracking (best before, use-by)
- PLU (Price Look-Up) code support
"""
from decimal import Decimal
from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class WeightedProductPolicy(AuditLogMixin, TenantOwnedModel):
    """
    Organization-level policy for fresh / variable-weight products.
    Singleton per org — governs how weight-embedded barcodes are built.
    """
    ENCODING_CHOICES = (
        ('PRICE_EMBEDDED', 'Price embedded in barcode (digits 7-11 = price)'),
        ('WEIGHT_EMBEDDED', 'Weight embedded in barcode (digits 7-11 = weight in grams)'),
        ('PLU', 'PLU code lookup (no weight/price in barcode)'),
    )
    SCALE_CHOICES = (
        ('GRAMS', 'Weight in grams (max 99999g)'),
        ('CENTIGRAMS', 'Weight in centigrams (max 999.99g)'),
        ('PRICE_CENTS', 'Price in cents (max 999.99)'),
    )

    encoding_mode = models.CharField(
        max_length=15, choices=ENCODING_CHOICES, default='PRICE_EMBEDDED',
        help_text='How weight/price is encoded in the barcode')
    scale_unit = models.CharField(
        max_length=15, choices=SCALE_CHOICES, default='GRAMS',
        help_text='Unit system for embedded weight')
    prefix = models.CharField(max_length=5, default='2',
        help_text='EAN prefix for variable-weight barcodes (typically "2")')

    # Tare weight
    default_tare_grams = models.IntegerField(default=0,
        help_text='Default tare weight in grams (packaging deduction)')
    require_tare_entry = models.BooleanField(default=False,
        help_text='Require tare weight entry on every weighing')

    # Shelf life
    default_shelf_life_days = models.IntegerField(default=3,
        help_text='Default shelf life in days for fresh products')
    require_best_before = models.BooleanField(default=True,
        help_text='Require best-before date on fresh product labels')
    require_use_by = models.BooleanField(default=False,
        help_text='Require use-by date (stricter than best-before)')

    # Label
    label_template = models.CharField(max_length=50, default='fresh_weight',
        help_text='Default label template for fresh products')
    show_price_per_kg = models.BooleanField(default=True,
        help_text='Show price-per-kg on label')
    show_ingredients = models.BooleanField(default=False,
        help_text='Show ingredients list on label')
    show_allergens = models.BooleanField(default=False,
        help_text='Show allergen warnings on label')

    class Meta:
        db_table = 'weighted_product_policy'
        constraints = [
            models.UniqueConstraint(fields=['organization'], name='unique_weight_policy_per_org'),
        ]

    def __str__(self):
        return f'WeightPolicy ({self.encoding_mode}) for org {self.organization_id}'


class ProductFreshProfile(AuditLogMixin, TenantOwnedModel):
    """
    Per-product fresh/weighted attributes.
    Only relevant for product_type=FRESH.
    """
    product = models.OneToOneField(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='fresh_profile',
    )

    # Weight
    typical_weight_grams = models.IntegerField(default=0,
        help_text='Typical weight per unit in grams (for estimation)')
    tare_weight_grams = models.IntegerField(default=0,
        help_text='Tare (packaging) weight to deduct from gross weight')
    min_weight_grams = models.IntegerField(default=0,
        help_text='Minimum weight threshold for QA rejection')
    max_weight_grams = models.IntegerField(default=0,
        help_text='Maximum weight threshold for QA alert')

    # Pricing
    price_per_kg = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Price per kilogram (the base reference price)')
    plu_code = models.CharField(max_length=10, blank=True, default='',
        help_text='PLU code for this product (used at POS scale)')

    # Shelf-life
    shelf_life_days = models.IntegerField(default=3,
        help_text='Days until best-before from production/weighing date')
    use_by_days = models.IntegerField(null=True, blank=True,
        help_text='Days until use-by (null = no use-by, only best-before)')

    # Content / Allergens
    ingredients = models.TextField(blank=True, default='',
        help_text='Ingredients list for label printing')
    allergens = models.TextField(blank=True, default='',
        help_text='Allergen declarations (comma-separated)')
    storage_instructions = models.CharField(max_length=255, blank=True, default='',
        help_text='Storage instructions (e.g. "Keep refrigerated at 4°C")')
    origin_country = models.CharField(max_length=100, blank=True, default='',
        help_text='Country of origin for traceability')

    class Meta:
        db_table = 'product_fresh_profile'

    def __str__(self):
        return f'Fresh profile: {self.product.name} ({self.price_per_kg}/kg)'

    @property
    def net_weight_grams(self):
        """Typical net weight (gross - tare)."""
        return max(0, self.typical_weight_grams - self.tare_weight_grams)

    @property
    def estimated_unit_price(self):
        """Estimated price based on typical weight."""
        if self.price_per_kg and self.net_weight_grams:
            return (self.price_per_kg * Decimal(self.net_weight_grams)) / Decimal(1000)
        return Decimal('0.00')
