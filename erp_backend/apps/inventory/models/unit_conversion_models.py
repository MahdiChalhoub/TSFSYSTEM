"""
Unit Conversion Matrix
=======================
Bidirectional unit conversions for multi-packaging products.

Example:
  1 carton = 12 bottles   →  UnitConversion(from=carton, to=bottle, ratio=12)
  1 pallet = 50 cartons   →  UnitConversion(from=pallet, to=carton, ratio=50)

Service resolves transitive chains:
  pallet → carton → bottle  =  50 × 12 = 600 bottles
"""
from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class UnitConversion(AuditLogMixin, TenantOwnedModel):
    """
    Bidirectional conversion factor between two units.
    from_unit × ratio = to_unit quantity.
    """
    from_unit = models.ForeignKey(
        'inventory.Unit', on_delete=models.CASCADE,
        related_name='conversions_from',
        help_text='Source unit (e.g., carton)'
    )
    to_unit = models.ForeignKey(
        'inventory.Unit', on_delete=models.CASCADE,
        related_name='conversions_to',
        help_text='Target unit (e.g., bottle)'
    )
    ratio = models.DecimalField(
        max_digits=15, decimal_places=6,
        help_text='1 from_unit = ratio × to_unit'
    )

    # Optional: product-specific conversion override
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='unit_conversions',
        help_text='Product-specific conversion (null = universal for this tenant)'
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'unit_conversion'
        unique_together = ('from_unit', 'to_unit', 'product', 'tenant')
        ordering = ['from_unit__name', 'to_unit__name']

    def __str__(self):
        product_label = f" [{self.product}]" if self.product else ""
        return f"1 {self.from_unit} = {self.ratio} {self.to_unit}{product_label}"

    def clean(self):
        if self.from_unit_id == self.to_unit_id:
            raise ValidationError("Cannot create a conversion from a unit to itself.")
        if self.ratio <= 0:
            raise ValidationError("Ratio must be positive.")

    def convert(self, qty, reverse=False):
        """
        Convert qty from source to target unit (or reverse).
        Forward:  qty × ratio  (e.g., 2 cartons → 24 bottles)
        Reverse:  qty / ratio  (e.g., 24 bottles → 2 cartons)
        """
        if reverse:
            return qty / self.ratio
        return qty * self.ratio
