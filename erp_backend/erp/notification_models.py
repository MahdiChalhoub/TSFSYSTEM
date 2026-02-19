"""
Notification System Models
===========================
Enhanced notification infrastructure with:
- Multi-channel support (IN_APP, EMAIL, SMS, PUSH)
- Template-based notifications
- Per-user channel preferences
"""
from django.db import models
from django.conf import settings
from django.utils import timezone


class NotificationTemplate(models.Model):
    """
    Reusable notification templates with variable substitution.
    Templates are coded (e.g. 'invoice_overdue') and can have
    different versions per channel and language.
    """
    CHANNELS = (
        ('IN_APP', 'In-App'),
        ('EMAIL', 'Email'),
        ('SMS', 'SMS'),
        ('PUSH', 'Push Notification'),
    )

    LANGUAGES = (
        ('en', 'English'),
        ('fr', 'French'),
        ('ar', 'Arabic'),
    )

    code = models.CharField(
        max_length=100,
        help_text="Unique template code, e.g. 'invoice_overdue', 'stock_alert'"
    )
    name = models.CharField(max_length=200, help_text="Human-readable name")
    channel = models.CharField(max_length=10, choices=CHANNELS, default='IN_APP')
    language = models.CharField(max_length=5, choices=LANGUAGES, default='en')

    subject_template = models.CharField(
        max_length=500,
        help_text="Subject line with {variable} placeholders"
    )
    body_template = models.TextField(
        help_text="Body with {variable} placeholders. Supports HTML for email."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notification_template'
        unique_together = ['code', 'channel', 'language']
        ordering = ['code', 'channel']

    def __str__(self):
        return f"{self.code} [{self.channel}/{self.language}]"

    def render_subject(self, variables: dict) -> str:
        """Render subject with variable substitution."""
        try:
            return self.subject_template.format(**variables)
        except (KeyError, IndexError):
            return self.subject_template

    def render_body(self, variables: dict) -> str:
        """Render body with variable substitution."""
        try:
            return self.body_template.format(**variables)
        except (KeyError, IndexError):
            return self.body_template


class NotificationPreference(models.Model):
    """
    Per-user notification channel preferences.
    Controls which channels are enabled for each notification type.
    """
    NOTIFICATION_TYPES = (
        ('invoice_overdue', 'Invoice Overdue'),
        ('invoice_paid', 'Invoice Paid'),
        ('stock_alert', 'Stock Alert'),
        ('po_approved', 'PO Approved'),
        ('po_received', 'PO Received'),
        ('payment_received', 'Payment Received'),
        ('system_update', 'System Update'),
        ('daily_digest', 'Daily Digest'),
    )

    CHANNELS = NotificationTemplate.CHANNELS

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    channel = models.CharField(max_length=10, choices=CHANNELS, default='IN_APP')
    is_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification_preference'
        unique_together = ['user', 'notification_type', 'channel']
        ordering = ['user', 'notification_type']

    def __str__(self):
        status = "✓" if self.is_enabled else "✗"
        return f"{self.user} | {self.notification_type} | {self.channel} {status}"


class NotificationLog(models.Model):
    """
    Tracks all notification deliveries across channels.
    Provides audit trail and delivery status tracking.
    """
    STATUS_CHOICES = (
        ('QUEUED', 'Queued'),
        ('SENT', 'Sent'),
        ('DELIVERED', 'Delivered'),
        ('FAILED', 'Failed'),
        ('BOUNCED', 'Bounced'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_logs'
    )
    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    channel = models.CharField(max_length=10, choices=NotificationTemplate.CHANNELS)
    subject = models.CharField(max_length=500)
    body = models.TextField()
    variables = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='QUEUED')
    error_message = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification_log'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.channel}] {self.subject} → {self.user} ({self.status})"

    def mark_sent(self):
        self.status = 'SENT'
        self.sent_at = timezone.now()
        self.save(update_fields=['status', 'sent_at'])

    def mark_delivered(self):
        self.status = 'DELIVERED'
        self.delivered_at = timezone.now()
        self.save(update_fields=['status', 'delivered_at'])

    def mark_failed(self, error: str):
        self.status = 'FAILED'
        self.error_message = error
        self.save(update_fields=['status', 'error_message'])
