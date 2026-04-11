"""
Product Task Engine — auto-generated tasks for shelf managers, print center, and controllers.

Tasks are created by governance events (verification, price changes, completeness level ups)
and displayed in a central task queue filtered by role/assignee.
"""
from django.db import models
from django.conf import settings
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class ProductTask(AuditLogMixin, TenantOwnedModel):
    """
    A discrete, actionable task related to a product.
    Auto-generated or manually created.
    """
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )
    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('DONE', 'Done'),
        ('CANCELLED', 'Cancelled'),
    )
    TASK_TYPE_CHOICES = (
        ('PRINT_LABEL', 'Print Label'),
        ('SHELF_PLACEMENT', 'Shelf Placement'),
        ('VERIFY_PRODUCT', 'Verify Product Data'),
        ('REVIEW_PRICE', 'Review Price Change'),
        ('COMPLETE_DATA', 'Complete Missing Data'),
        ('PHOTO_UPLOAD', 'Upload Product Photo'),
        ('CUSTOM', 'Custom Task'),
    )

    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='tasks',
    )
    task_type = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='OPEN')

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='product_tasks',
    )
    assigned_role = models.CharField(max_length=50, blank=True, default='',
        help_text='Role hint for unassigned tasks (e.g. shelf_manager, print_center, controller)')

    # Tracking
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='completed_product_tasks',
    )

    # Link to source event (optional)
    source_event = models.CharField(max_length=20, blank=True, default='',
        help_text='Governance event that triggered this task')
    source_id = models.PositiveIntegerField(null=True, blank=True,
        help_text='ID of the source entity (e.g. PriceChangeRequest.id)')

    class Meta:
        db_table = 'product_task'
        ordering = ['-pk']
        indexes = [
            models.Index(fields=['organization', 'status', 'priority'],
                         name='ptask_org_status_prio_idx'),
            models.Index(fields=['assigned_to', 'status'],
                         name='ptask_assignee_status_idx'),
            models.Index(fields=['product', 'task_type'],
                         name='ptask_product_type_idx'),
        ]

    def __str__(self):
        return f'[{self.task_type}] {self.title} ({self.status})'
