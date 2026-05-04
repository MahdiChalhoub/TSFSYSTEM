"""
GeneratedDocument — Async Invoice / Receipt PDF store
====================================================
Tracks background PDF generation tasks and stores
the resulting file reference once the Celery task completes.
"""
from django.db import models
from erp.models import Organization, TenantModel


class GeneratedDocument(TenantModel):
    """Tracks background PDF generation tasks (per-organization).

    Tenant Isolation: ✅ via TenantModel (auto-filter by current organization).
    """
    DOC_TYPE_CHOICES = [
        ('INVOICE',    'Sales Invoice'),
        ('RECEIPT',    'POS Receipt'),
        ('PURCHASE_ORDER', 'Purchase Order'),
        ('TAX_CERT',   'Tax Certificate'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('READY',   'Ready'),
        ('FAILED',  'Failed'),
    ]

    # DB uses tenant_id (multi-tenant convention).
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='generated_documents',
        db_column='tenant_id',
    )
    # Source references (one or the other, both nullable)
    order_id       = models.IntegerField(null=True, blank=True, db_index=True)
    purchase_id    = models.IntegerField(null=True, blank=True, db_index=True)

    doc_type    = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES, default='INVOICE')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    task_id     = models.CharField(max_length=155, blank=True, null=True)  # Celery task UUID
    file_path   = models.CharField(max_length=512, blank=True, null=True)  # Relative path in MEDIA_ROOT
    error_msg   = models.TextField(blank=True, null=True)

    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'pos'
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['organization', 'order_id', 'doc_type']),
            models.Index(fields=['task_id']),
        ]

    def __str__(self):
        return f"[{self.doc_type}] org={self.organization_id} order={self.order_id} status={self.status}"
