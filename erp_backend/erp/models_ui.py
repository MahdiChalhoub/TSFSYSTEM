"""
User Interface Models — erp/models_ui.py
Notification and UDLE (Universal Data List Engine) models.
Extracted from erp/models.py to keep the kernel under 500 lines.
"""
from django.db import models


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('INFO', 'Information'),
        ('SUCCESS', 'Success'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
    )
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=10, choices=NOTIFICATION_TYPES, default='INFO')
    link = models.CharField(max_length=255, null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} for {self.user}"

    def mark_as_read(self):
        from django.utils import timezone
        self.read_at = timezone.now()
        self.save(update_fields=['read_at'])


class UDLESavedView(models.Model):
    """
    Persists user customizations for a specific model/view in UDLE.
    Stores visible columns, filters, and sorting preferences.
    """
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='udle_views')
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE)
    model_name = models.CharField(max_length=100)  # e.g., 'Product', 'InventoryMovement'
    name = models.CharField(max_length=100)
    config = models.JSONField(default=dict)  # {columns: [], filters: {}, sorting: {}}
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'udle_saved_view'
        unique_together = ('user', 'model_name', 'name')
        verbose_name = "UDLE Saved View"
        verbose_name_plural = "UDLE Saved Views"

    def __str__(self):
        return f"{self.name} ({self.model_name}) for {self.user}"
