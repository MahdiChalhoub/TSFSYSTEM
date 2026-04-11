"""
Domain Event System — Models
==============================
Tenant-scoped outbound webhook infrastructure for eCommerce order lifecycle events.

Events emitted:
    order.placed       — when a cart is placed (status → PLACED)
    order.confirmed    — when admin confirms (PLACED → CONFIRMED)
    order.shipped      — when order is shipped (PROCESSING → SHIPPED)
    order.delivered    — when order is delivered (SHIPPED → DELIVERED)
    order.cancelled    — on any → CANCELLED transition
    order.returned     — on any → RETURNED transition
    payment.confirmed  — when payment_status becomes PAID

Webhook subscriptions are configured per-org via the admin UI.
Each delivery attempt is logged in WebhookDeliveryLog for debugging.
"""
from django.db import models
from erp.models import TenantModel


SUPPORTED_EVENTS = [
    ('order.placed',      'Order Placed'),
    ('order.confirmed',   'Order Confirmed'),
    ('order.shipped',     'Order Shipped'),
    ('order.delivered',   'Order Delivered'),
    ('order.cancelled',   'Order Cancelled'),
    ('order.returned',    'Order Returned'),
    ('payment.confirmed', 'Payment Confirmed'),
]


class WebhookSubscription(TenantModel):
    """
    An org-configured outbound webhook endpoint for a specific event type.

    Security: each delivery signs the payload body with HMAC-SHA256 using
    `secret` and sends the digest in the `X-TSFSYSTEM-Signature` header.
    The receiver can verify authenticity before processing.
    """
    event_type = models.CharField(
        max_length=50,
        choices=SUPPORTED_EVENTS,
        help_text="Event type to subscribe to (e.g. 'order.placed')"
    )
    target_url = models.URLField(
        help_text="URL that will receive POST requests with the event payload"
    )
    secret = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="HMAC-SHA256 secret for payload signing. Set and share with the receiver."
    )
    description = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'webhook_subscription'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_event_type_display()}] → {self.target_url}"


class WebhookDeliveryLog(TenantModel):
    """
    Immutable audit trail of every outbound webhook attempt.
    Allows debugging delivery failures and retry tracking.
    """
    subscription = models.ForeignKey(
        WebhookSubscription,
        on_delete=models.CASCADE,
        related_name='delivery_logs',
    )
    event_type = models.CharField(max_length=50)
    payload = models.JSONField()

    # Outcome
    response_status = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True, default='')
    delivered_at = models.DateTimeField(null=True, blank=True)
    failed = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default='')
    retry_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'webhook_delivery_log'
        ordering = ['-created_at']

    def __str__(self):
        status = 'OK' if not self.failed else 'FAIL'
        return f"[{status}] {self.event_type} → {self.subscription.target_url}"
