"""
Report Builder Models
======================
User-defined report definitions with configurable filters, columns,
scheduling, and export formats.
"""
from django.db import models
from erp.models import TenantModel, User


class ReportDefinition(TenantModel):
    """
    A saved report definition that can be run on-demand or on a schedule.
    Supports dynamic query building with JSON-defined filters and columns.
    """
    REPORT_TYPES = (
        ('SALES', 'Sales Report'),
        ('PURCHASES', 'Purchase Report'),
        ('INVENTORY', 'Inventory Report'),
        ('FINANCIAL', 'Financial Report'),
        ('CUSTOMER', 'Customer Report'),
        ('SUPPLIER', 'Supplier Report'),
        ('HR', 'HR Report'),
        ('CUSTOM', 'Custom Query'),
    )
    EXPORT_FORMATS = (
        ('PDF', 'PDF'),
        ('EXCEL', 'Excel (.xlsx)'),
        ('CSV', 'CSV'),
        ('JSON', 'JSON'),
    )

    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_reports')

    # Query definition (JSON)
    data_source = models.CharField(
        max_length=100, help_text='Model/table name to query, e.g. "Order", "Invoice", "Product"'
    )
    columns = models.JSONField(
        default=list, blank=True,
        help_text='List of column definitions: [{"field": "name", "label": "Name", "width": 20}, ...]'
    )
    filters = models.JSONField(
        default=list, blank=True,
        help_text='List of filter conditions: [{"field": "status", "op": "eq", "value": "COMPLETED"}, ...]'
    )
    group_by = models.JSONField(
        default=list, blank=True,
        help_text='Group by fields: ["category", "month"]'
    )
    order_by = models.JSONField(
        default=list, blank=True,
        help_text='Order by fields: ["-created_at", "name"]'
    )
    limit = models.IntegerField(default=1000, help_text='Max rows to return')

    # Aggregations
    aggregations = models.JSONField(
        default=list, blank=True,
        help_text='Aggregation definitions: [{"field": "total_amount", "func": "sum", "label": "Total Revenue"}]'
    )

    # Export config
    default_export_format = models.CharField(max_length=10, choices=EXPORT_FORMATS, default='EXCEL')

    # Scheduling (cron-like)
    is_scheduled = models.BooleanField(default=False)
    schedule_cron = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Cron expression: "0 8 * * 1" (Mon at 8am)'
    )
    email_recipients = models.JSONField(
        default=list, blank=True,
        help_text='Email addresses for scheduled delivery'
    )
    last_run_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    is_public = models.BooleanField(default=False, help_text='Visible to all org users')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'report_definition'
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} ({self.report_type})"


class ReportExecution(TenantModel):
    """Record of a report execution — stores status and output file reference."""
    STATUS_CHOICES = (
        ('QUEUED', 'Queued'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    )

    report = models.ForeignKey(ReportDefinition, on_delete=models.CASCADE, related_name='executions')
    executed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='QUEUED')
    export_format = models.CharField(max_length=10, default='EXCEL')
    output_file = models.CharField(max_length=500, null=True, blank=True, help_text='Path to generated file')
    row_count = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'report_execution'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.report.name} — {self.status} ({self.created_at})"
