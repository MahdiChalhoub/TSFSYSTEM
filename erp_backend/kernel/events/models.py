"""
Event Models

DomainEvent: Outbox pattern for reliable event delivery
EventSubscription: Event handler registry
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from kernel.tenancy.models import TenantOwnedModel
import uuid

User = get_user_model()


class DomainEvent(TenantOwnedModel):
    """
    Domain Event - Outbox Pattern

    Events are:
    1. Stored in database (within same transaction as domain change)
    2. Processed asynchronously by background worker
    3. Marked as processed after successful delivery

    This ensures:
    - Events are never lost (transactional)
    - Events are delivered at least once
    - Event ordering is preserved
    """

    # Unique event ID
    event_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # Event metadata
    event_type = models.CharField(max_length=100, db_index=True)
    event_version = models.IntegerField(default=1)

    # Event payload
    payload = models.JSONField(default=dict)

    # Aggregate information (what entity this event is about)
    aggregate_type = models.CharField(max_length=50, blank=True, db_index=True)
    aggregate_id = models.CharField(max_length=100, blank=True, db_index=True)

    # Who triggered this event
    triggered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='triggered_events'
    )

    # Timestamps
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    # Processing status
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('PROCESSED', 'Processed'),
        ('FAILED', 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)

    # Retry tracking
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    next_retry_at = models.DateTimeField(null=True, blank=True)

    # Error tracking
    error_message = models.TextField(blank=True)
    last_error_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'erp'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['tenant', 'status', 'created_at']),
            models.Index(fields=['tenant', 'event_type', 'created_at']),
            models.Index(fields=['aggregate_type', 'aggregate_id', 'created_at']),
            models.Index(fields=['status', 'next_retry_at']),
        ]
        verbose_name = 'Domain Event'
        verbose_name_plural = 'Domain Events'

    def __str__(self):
        return f"{self.event_type} | {self.aggregate_type}:{self.aggregate_id} | {self.status}"

    def mark_processed(self):
        """Mark event as successfully processed."""
        self.status = 'PROCESSED'
        self.processed_at = timezone.now()
        self.save()

    def mark_failed(self, error_message: str):
        """Mark event as failed and schedule retry."""
        from datetime import timedelta

        self.status = 'FAILED'
        self.error_message = error_message
        self.last_error_at = timezone.now()
        self.retry_count += 1

        if self.retry_count < self.max_retries:
            # Exponential backoff: 1min, 5min, 15min
            delay_minutes = 1 * (5 ** (self.retry_count - 1))
            self.next_retry_at = timezone.now() + timedelta(minutes=delay_minutes)
            self.status = 'PENDING'  # Allow retry
        else:
            # Max retries reached - stay in FAILED state
            self.next_retry_at = None

        self.save()

    def can_retry(self) -> bool:
        """Check if event can be retried."""
        if self.status != 'PENDING':
            return False
        if self.next_retry_at and self.next_retry_at > timezone.now():
            return False
        return True


class EventSubscription(models.Model):
    """
    Event Subscription Registry

    Tracks which handlers are subscribed to which events.
    Used by event bus to route events to handlers.
    """

    # Event pattern (supports wildcards)
    event_pattern = models.CharField(max_length=100, db_index=True)

    # Handler information
    handler_name = models.CharField(max_length=200)
    handler_module = models.CharField(max_length=200)

    # Configuration
    is_active = models.BooleanField(default=True)
    priority = models.IntegerField(default=0)  # Higher priority = executed first

    # Metadata
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'erp'
        ordering = ['-priority', 'handler_name']
        unique_together = [['event_pattern', 'handler_name']]
        verbose_name = 'Event Subscription'
        verbose_name_plural = 'Event Subscriptions'

    def __str__(self):
        return f"{self.event_pattern} → {self.handler_name}"
