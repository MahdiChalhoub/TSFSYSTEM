"""
Product Readiness Model — operational readiness sub-states.

A product can be data-complete but not operationally ready.
This model tracks granular readiness dimensions.
"""
from django.db import models
from django.conf import settings
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class ProductReadiness(AuditLogMixin, TenantOwnedModel):
    """
    Per-product operational readiness assessment.
    Each boolean dimension tracks a specific operational capability.
    Auto-refreshed by ReadinessService from product/packaging/label state.
    """
    product = models.OneToOneField(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='readiness',
    )

    # ── Scan & Label ─────────────────────────────────────────────────
    is_scan_ready = models.BooleanField(default=False,
        help_text='Product has a valid primary barcode and is resolvable by POS scanner')
    is_label_ready = models.BooleanField(default=False,
        help_text='Product has a valid label currently printed (not invalidated)')

    # ── Shelf & Store ────────────────────────────────────────────────
    is_shelf_ready = models.BooleanField(default=False,
        help_text='Product has been placed on shelf with location assigned')
    is_purchase_ready = models.BooleanField(default=False,
        help_text='Product has at least one active supplier with valid pricing')
    is_replenishment_ready = models.BooleanField(default=False,
        help_text='Product has min_stock_level set and replenishment rule configured')
    is_catalog_ready = models.BooleanField(default=False,
        help_text='Product has image, catalog description, and is approved for display')

    # ── Timestamps ───────────────────────────────────────────────────
    last_assessed_at = models.DateTimeField(auto_now=True,
        help_text='When readiness was last computed')
    last_assessed_by = models.CharField(max_length=50, default='system',
        help_text='Who/what triggered the last assessment')

    class Meta:
        db_table = 'product_readiness'

    def __str__(self):
        score = sum([
            self.is_scan_ready, self.is_label_ready, self.is_shelf_ready,
            self.is_purchase_ready, self.is_replenishment_ready, self.is_catalog_ready,
        ])
        return f'Readiness {score}/6 for product {self.product_id}'

    @property
    def score(self):
        """Number of readiness dimensions met (0-6)."""
        return sum([
            self.is_scan_ready, self.is_label_ready, self.is_shelf_ready,
            self.is_purchase_ready, self.is_replenishment_ready, self.is_catalog_ready,
        ])

    @property
    def status(self):
        """Overall readiness: READY / PARTIAL / NOT_READY."""
        s = self.score
        if s == 6: return 'READY'
        if s > 0: return 'PARTIAL'
        return 'NOT_READY'

    @property
    def missing(self):
        """List of not-ready dimensions."""
        result = []
        if not self.is_scan_ready: result.append('scan')
        if not self.is_label_ready: result.append('label')
        if not self.is_shelf_ready: result.append('shelf')
        if not self.is_purchase_ready: result.append('purchase')
        if not self.is_replenishment_ready: result.append('replenishment')
        if not self.is_catalog_ready: result.append('catalog')
        return result
