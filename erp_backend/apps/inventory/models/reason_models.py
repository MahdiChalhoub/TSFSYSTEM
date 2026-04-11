"""
Adjustment Reason Codes
========================
Auditor-required taxonomy for inventory adjustments.
Every adjustment must reference a reason code.
"""
from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class AdjustmentReason(AuditLogMixin, TenantOwnedModel):
    """
    Controlled list of reasons for stock adjustments.
    Required by auditors for accountability.
    """
    CATEGORY_CHOICES = (
        ('DAMAGE', 'Damage'),
        ('LOSS', 'Loss'),
        ('THEFT', 'Theft'),
        ('CORRECTION', 'Count Correction'),
        ('EXPIRED', 'Expired'),
        ('RETURN', 'Return'),
        ('WRITE_OFF', 'Write Off'),
        ('OTHER', 'Other'),
    )

    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='OTHER')
    description = models.TextField(null=True, blank=True)
    requires_approval = models.BooleanField(
        default=False,
        help_text='If true, adjustments with this reason require manager approval'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'adjustment_reason'
        unique_together = ('code', 'organization')
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.code} — {self.name} ({self.get_category_display()})"
