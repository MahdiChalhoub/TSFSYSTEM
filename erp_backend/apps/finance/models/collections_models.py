"""
Collections / Dunning models.

Dunning = the process of methodically escalating communications with a
customer who has overdue invoices. The industry-standard sequence:
  Level 1: friendly reminder        (~7 days past due)
  Level 2: formal notice            (~30 days past due)
  Level 3: final demand             (~60 days past due)
  LEGAL:   escalated to collections  (~90+ days past due)

This module captures:
  - `DunningReminder`: immutable audit record of a reminder sent to
    a customer at a specific level. One row per send attempt.

Per-contact state (last reminder level, next due date, etc.) is
DERIVED from these rows at read time — no denormalized column
drift, no stale "last reminder" field to update.
"""
from decimal import Decimal
from django.db import models
from erp.models import TenantModel


class DunningReminder(TenantModel):
    """One reminder event for one customer contact.

    Immutable by convention — operators reverse/cancel via status
    transitions, never by editing fields.
    """
    LEVEL_CHOICES = (
        (1, 'Level 1 — Friendly reminder'),
        (2, 'Level 2 — Formal notice'),
        (3, 'Level 3 — Final demand'),
        (4, 'Legal escalation'),
    )
    METHOD_CHOICES = (
        ('EMAIL', 'Email'),
        ('SMS', 'SMS'),
        ('POST', 'Postal mail'),
        ('CALL', 'Phone call'),
        ('PORTAL', 'Client portal notification'),
    )
    STATUS_CHOICES = (
        ('QUEUED', 'Queued'),
        ('SENT', 'Sent'),
        ('DELIVERED', 'Delivered (confirmed)'),
        ('FAILED', 'Failed to deliver'),
        ('CANCELLED', 'Cancelled'),
        ('ACKNOWLEDGED', 'Customer acknowledged'),
    )

    # Links
    contact_id = models.IntegerField(
        db_index=True,
        help_text='FK to CRM Contact — decoupled to avoid app import cycle',
    )
    contact_name = models.CharField(
        max_length=255,
        help_text='Denormalized at send time — survives contact rename',
    )

    # Reminder content
    level = models.PositiveSmallIntegerField(choices=LEVEL_CHOICES, default=1)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default='EMAIL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='QUEUED')

    # Amounts as-of send time — reflect the state we dunned against
    amount_overdue = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
    )
    oldest_invoice_days = models.PositiveIntegerField(
        default=0,
        help_text='Age (days past due) of the oldest overdue invoice at send time',
    )
    invoices_referenced = models.JSONField(
        default=list,
        help_text='Snapshot of invoice IDs + amounts at send time',
    )

    # Operator-visible content
    subject = models.CharField(max_length=300, blank=True, default='')
    body = models.TextField(
        blank=True, default='',
        help_text='Rendered body at send time — preserved for audit',
    )
    notes = models.TextField(
        blank=True, default='',
        help_text='Internal ops notes (not sent to customer)',
    )

    # Audit + delivery tracking
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='dunning_reminders_sent',
    )
    delivery_ref = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Provider message ID (e.g. SES message-id) for correlation',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_dunning_reminder'
        indexes = [
            models.Index(fields=['organization', 'contact_id']),
            models.Index(fields=['organization', 'level']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'sent_at']),
        ]
        ordering = ['-sent_at', '-id']

    def __str__(self):
        return f"L{self.level} to {self.contact_name} ({self.status})"
