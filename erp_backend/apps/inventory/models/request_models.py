from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin

class OperationalRequest(AuditLogMixin, TenantOwnedModel):
    REQUEST_TYPES = (
        ('PURCHASE_ORDER', 'Purchase Order'),
        ('STOCK_ADJUSTMENT', 'Stock Adjustment'),
        ('STOCK_TRANSFER', 'Stock Transfer'),
    )
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )
    REQUEST_STATUS = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('CONVERTED', 'Converted'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    )

    reference = models.CharField(max_length=100, null=True, blank=True)
    request_type = models.CharField(max_length=30, choices=REQUEST_TYPES)
    requested_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='operational_requests')
    date = models.DateField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')
    status = models.CharField(max_length=20, choices=REQUEST_STATUS, default='PENDING')
    description = models.TextField(null=True, blank=True)
    approved_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_requests')
    approved_at = models.DateTimeField(null=True, blank=True)
    converted_to_type = models.CharField(max_length=30, null=True, blank=True)
    converted_to_id = models.IntegerField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'operational_request'
        ordering = ['-date', '-created_at']


class OperationalRequestLine(AuditLogMixin, TenantOwnedModel):
    request = models.ForeignKey(OperationalRequest, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'operational_request_line'
