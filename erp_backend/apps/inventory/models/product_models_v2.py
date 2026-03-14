"""
Product Models - Migrated to Kernel OS v2.0
============================================

This is a TEMPLATE showing how Product should look with full Kernel OS integration.
Copy relevant sections to product_models.py
"""

from django.db import models
from django.db.models import Q, UniqueConstraint
from decimal import Decimal
from erp.models import Country
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.events import emit_event


class Product(AuditLogMixin, TenantOwnedModel):
    """
    Product model with full Kernel OS v2.0 integration

    Features:
    - Automatic organization isolation via TenantOwnedModel
    - Automatic audit logging via AuditLogMixin
    - Event emission on create/update
    - Contract-validated events
    """

    PRODUCT_TYPES = (
        ('STANDARD', 'Standard'),
        ('COMBO', 'Combo / Bundle'),
        ('SERVICE', 'Service'),
    )

    # Basic fields
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES, default='STANDARD')

    # Relationships
    category = models.ForeignKey('Category', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    brand = models.ForeignKey('Brand', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    unit = models.ForeignKey('Unit', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)
    parfum = models.ForeignKey('Parfum', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    product_group = models.ForeignKey('ProductGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')

    # Size
    size = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    size_unit = models.ForeignKey('Unit', on_delete=models.SET_NULL, null=True, blank=True, related_name='sized_products')

    # Legacy
    legacy_id = models.IntegerField(null=True, blank=True)
    image_url = models.CharField(max_length=500, null=True, blank=True)

    # Pricing
    cost_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    selling_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    selling_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tva_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))

    # Stock Management
    min_stock_level = models.IntegerField(default=10)
    max_stock_level = models.IntegerField(null=True, blank=True)
    reorder_point = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    reorder_quantity = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    # Tracking
    is_expiry_tracked = models.BooleanField(default=False)
    tracks_serials = models.BooleanField(default=False)

    # Status
    status = models.CharField(max_length=20, default='ACTIVE')
    is_active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'product'
        constraints = [
            UniqueConstraint(fields=['sku', 'organization'], name='unique_product_sku_per_tenant'),
            UniqueConstraint(
                fields=['barcode', 'organization'],
                name='unique_product_barcode_per_tenant',
                condition=Q(barcode__isnull=False)
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'category', 'is_active'], name='product_tenant_cat_active_idx'),
            models.Index(fields=['organization', 'status'], name='product_tenant_status_idx'),
            models.Index(fields=['organization', 'min_stock_level'], name='product_tenant_minstk_idx'),
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"

    def save(self, *args, **kwargs):
        """
        Override save to emit events

        Emits product.created or product.updated events according to contracts
        """
        is_new = self.pk is None

        # Call parent save (includes audit logging from AuditLogMixin)
        super().save(*args, **kwargs)

        # Emit appropriate event
        if is_new:
            emit_event('product.created', {
                'product_id': self.id,
                'sku': self.sku,
                'name': self.name,
                'category_id': self.category_id if self.category else None,
                'cost_price': float(self.cost_price),
                'selling_price': float(self.selling_price_ttc),
                'organization_id': self.organization_id
            })
