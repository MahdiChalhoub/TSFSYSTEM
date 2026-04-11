"""
BarcodeChangeRequest — formal approval workflow for barcode changes.
Mirrors PriceChangeRequest pattern.

Flow: PENDING → APPROVED/REJECTED → (auto-applied if APPROVED)
"""
from django.db import models
from django.conf import settings
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class BarcodeChangeRequest(AuditLogMixin, TenantOwnedModel):
    """
    Formal approval workflow for barcode changes.
    Created when BarcodePolicy.change_requires_approval=True.
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('APPLIED', 'Applied'),
        ('CANCELLED', 'Cancelled'),
    )
    CHANGE_TYPE_CHOICES = (
        ('MANUAL', 'Manual Change'),
        ('SUPPLIER_UPDATE', 'Supplier Barcode Update'),
        ('FORMAT_MIGRATION', 'Format Migration (e.g. EAN-8 → EAN-13)'),
        ('RECALL', 'Product Recall / Safety'),
        ('CORRECTION', 'Data Correction'),
    )

    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='barcode_change_requests',
    )
    packaging = models.ForeignKey(
        'inventory.ProductPackaging', on_delete=models.CASCADE,
        null=True, blank=True, related_name='barcode_change_requests',
        help_text='If set, this change is for a packaging-level barcode',
    )

    # Barcode change details
    current_barcode = models.CharField(max_length=100,
        help_text='Current barcode at time of request')
    proposed_barcode = models.CharField(max_length=100,
        help_text='Proposed new barcode')

    # Justification
    reason = models.TextField(blank=True, default='',
        help_text='Business justification for the barcode change')
    change_type = models.CharField(max_length=20, choices=CHANGE_TYPE_CHOICES, default='MANUAL')

    # Workflow
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='barcode_change_requests_made',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='barcode_change_requests_reviewed',
    )
    review_notes = models.TextField(blank=True, default='',
        help_text='Notes from the reviewer (approve/reject rationale)')

    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'barcode_change_request'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['organization', 'status'], name='bcr_org_status_idx'),
            models.Index(fields=['product', 'status'], name='bcr_product_status_idx'),
        ]

    def __str__(self):
        scope = f' PKG:{self.packaging_id}' if self.packaging_id else ''
        return f'BCR-{self.pk}: {self.product.sku}{scope} {self.current_barcode}→{self.proposed_barcode} ({self.status})'

    def apply(self):
        """Apply the approved barcode change through BarcodeService."""
        if self.status != 'APPROVED':
            raise ValueError('Can only apply APPROVED barcode changes')
        from django.utils import timezone
        from apps.inventory.services.barcode_service import BarcodeService
        BarcodeService._apply_barcode_change(
            self.product, self.current_barcode, self.proposed_barcode,
            user=self.reviewed_by, packaging=self.packaging,
        )
        self.status = 'APPLIED'
        self.applied_at = timezone.now()
        self.save(update_fields=['status', 'applied_at'])
