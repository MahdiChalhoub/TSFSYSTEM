"""
Supplier Package Pricing — links supplier × product × packaging with pricing,
validity periods, and supplier-specific identifiers.
"""
from decimal import Decimal
from django.db import models
from erp.models import TenantModel


class SupplierPackagePrice(TenantModel):
    """
    Supplier-specific pricing per product+packaging combination.
    Extends ProductSupplier with packaging-level granularity.

    Example:
      Supplier "ABC Trading" sells Coca Cola:
        - Can 330ml:  500 XOF (buy unit)
        - Pack of 6:  2800 XOF
        - Carton 24:  10000 XOF (bulk discount)
    """
    product_supplier = models.ForeignKey(
        'pos.ProductSupplier', on_delete=models.CASCADE,
        related_name='package_prices',
    )
    packaging = models.ForeignKey(
        'inventory.ProductPackaging', on_delete=models.CASCADE,
        null=True, blank=True, related_name='supplier_prices',
        help_text='Null = base unit price (no specific packaging)'
    )

    # Pricing
    purchase_price_ht = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Purchase price excl. tax')
    purchase_price_ttc = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Purchase price incl. tax')
    currency = models.CharField(max_length=10, default='XOF')

    # Quantity brackets
    min_qty = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('1.00'),
        help_text='Minimum quantity for this price to apply')
    max_qty = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Maximum quantity for this price (null = unlimited)')

    # Validity
    valid_from = models.DateField(null=True, blank=True,
        help_text='Price effective date (null = always valid)')
    valid_until = models.DateField(null=True, blank=True,
        help_text='Price expiry date (null = no expiry)')
    is_active = models.BooleanField(default=True)

    # Supplier identifiers for this specific package
    supplier_barcode = models.CharField(max_length=100, null=True, blank=True,
        help_text='Supplier barcode for this product/packaging combo')
    supplier_ref = models.CharField(max_length=100, null=True, blank=True,
        help_text='Supplier reference/part number for this packaging')

    # Flags
    is_default_purchase_price = models.BooleanField(default=False,
        help_text='Use this price as default when creating PO lines')

    class Meta:
        db_table = 'supplier_package_price'
        ordering = ['min_qty']
        indexes = [
            models.Index(
                fields=['product_supplier', 'packaging', 'is_active'],
                name='spp_supplier_pkg_active_idx',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['product_supplier', 'packaging', 'min_qty', 'organization'],
                name='unique_spp_per_supplier_pkg_qty',
            ),
        ]

    def __str__(self):
        pkg = self.packaging.name if self.packaging else 'Base Unit'
        return f'{self.product_supplier.supplier.name}: {pkg} @ {self.purchase_price_ttc}'

    @property
    def is_valid(self):
        """Check if price is currently within validity period."""
        from django.utils import timezone
        today = timezone.now().date()
        if self.valid_from and today < self.valid_from:
            return False
        if self.valid_until and today > self.valid_until:
            return False
        return self.is_active
