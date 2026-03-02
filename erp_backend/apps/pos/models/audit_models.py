from django.db import models
from erp.models import Organization, User
from .register_models import POSRegister

class POSAuditRule(models.Model):
    """
    Configuration rules for how different POS events should be handled
    by the notification and task system.
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='pos_audit_rules')
    event_type = models.CharField(max_length=50) # e.g. 'PRICE_CHANGE', 'DISCOUNT', 'CLEAR_CART', 'REMOVE_ITEM'
    
    send_notification = models.BooleanField(default=False)
    create_task = models.BooleanField(default=False)
    
    # Comma separated list of role names or user IDs to notify/assign
    notify_roles = models.CharField(max_length=255, blank=True, null=True, help_text="Roles to notify (e.g. 'Manager,Admin')")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pos_audit_rule'
        unique_together = ('organization', 'event_type')

class POSAuditEvent(models.Model):
    """
    Log of sensitive or critical events occurring in the POS system.
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='pos_audit_events')
    register = models.ForeignKey(POSRegister, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_events')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pos_audit_events')
    
    event_type = models.CharField(max_length=50)
    event_name = models.CharField(max_length=150)
    
    # A JSON payload containing the specific details of the event
    # e.g., {"product": "Item X", "old_qty": 5, "new_qty": 2}
    details = models.JSONField(default=dict)
    
    # Reference to an order or ticket if applicable
    reference_id = models.CharField(max_length=100, blank=True, null=True)
    
    is_reviewed = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_pos_events')
    review_notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pos_audit_event'
        ordering = ['-created_at']


# =============================================================================
# GAP 8 — SALES AUDIT LOG (Structured, Order-Level Immutable Diff Log)
# =============================================================================

class SalesAuditLog(models.Model):
    """
    Immutable, append-only log of all workflow and field-change events
    on a sales Order.

    Each row captures:
      - Which order was affected
      - Who triggered the event
      - What action/event type occurred
      - A structured diff: {field: {before, after}} for changed fields
      - The full new state snapshot of 4-axis statuses

    Design: Never update or delete rows. Always append.
    DB table has no update timestamp — only created_at.
    """

    # ── Action type catalogue ─────────────────────────────────────────────────
    ACTION_TYPES = [
        # Order-axis events
        ('ORDER_CONFIRMED',   'Order Confirmed'),
        ('ORDER_PROCESSING',  'Order In Processing'),
        ('ORDER_CLOSED',      'Order Closed'),
        ('ORDER_CANCELLED',   'Order Cancelled'),
        # Delivery-axis events
        ('DELIVERY_PARTIAL',  'Partial Delivery'),
        ('DELIVERY_DELIVERED','Delivered'),
        ('DELIVERY_RETURNED', 'Returned'),
        ('DELIVERY_NA',       'Delivery N/A'),
        # Payment-axis events
        ('PAYMENT_PARTIAL',   'Partial Payment'),
        ('PAYMENT_PAID',      'Paid in Full'),
        ('PAYMENT_WRITTEN_OFF','Written Off'),
        ('PAYMENT_OVERPAID',  'Overpaid'),
        # Invoice-axis events
        ('INVOICE_GENERATED', 'Invoice Generated'),
        ('INVOICE_SENT',      'Invoice Sent'),
        ('INVOICE_DISPUTED',  'Invoice Disputed'),
        # Stock events
        ('STOCK_RESERVED',    'Stock Reserved'),
        ('STOCK_RELEASED',    'Stock Released'),
        ('STOCK_DEDUCTED',    'Stock Deducted on Delivery'),
        # Generic / catch-all
        ('FIELD_CHANGE',      'Field Changed'),
        ('WORKFLOW_TRANSITION','Workflow Transition'),
        ('NOTE',              'Manual Note'),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='sales_audit_logs', db_index=True
    )
    order = models.ForeignKey(
        'pos.Order', on_delete=models.CASCADE,
        related_name='audit_logs', db_index=True
    )
    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sales_audit_actions'
    )
    actor_name = models.CharField(
        max_length=150, blank=True,
        help_text='Denormalised actor name for display after user deletion'
    )
    action_type = models.CharField(max_length=30, choices=ACTION_TYPES, db_index=True)
    summary     = models.CharField(max_length=255, help_text='One-line human-readable summary')

    # ── Structured diff ───────────────────────────────────────────────────────
    diff = models.JSONField(
        default=dict, blank=True,
        help_text='{"field": {"before": ..., "after": ...}, ...}'
    )

    # ── 4-axis snapshot at time of event ─────────────────────────────────────
    order_status_snap    = models.CharField(max_length=20, blank=True)
    delivery_status_snap = models.CharField(max_length=20, blank=True)
    payment_status_snap  = models.CharField(max_length=20, blank=True)
    invoice_status_snap  = models.CharField(max_length=20, blank=True)

    # ── Context ───────────────────────────────────────────────────────────────
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    extra      = models.JSONField(default=dict, blank=True,
        help_text='Arbitrary extra context (e.g. stock_qty, amount_paid)')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table   = 'sales_audit_log'
        ordering   = ['-created_at']
        indexes    = [
            models.Index(fields=['organization', 'order', 'created_at']),
            models.Index(fields=['organization', 'action_type', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.action_type}] Order #{self.order_id} by {self.actor_name} @ {self.created_at:%Y-%m-%d %H:%M}"

    @classmethod
    def log(cls, order, action_type: str, summary: str,
            actor=None, diff: dict = None, extra: dict = None,
            ip_address: str = None) -> 'SalesAuditLog':
        """
        Convenience factory — call from workflow service and signals.
        Never raises: if anything fails the entry is silently skipped.
        """
        try:
            actor_name = ''
            if actor:
                actor_name = actor.get_full_name() or actor.username

            return cls.objects.create(
                organization=order.organization,
                order=order,
                actor=actor,
                actor_name=actor_name,
                action_type=action_type,
                summary=summary,
                diff=diff or {},
                order_status_snap=order.order_status or '',
                delivery_status_snap=order.delivery_status or '',
                payment_status_snap=order.payment_status or '',
                invoice_status_snap=order.invoice_status or '',
                ip_address=ip_address,
                extra=extra or {},
            )
        except Exception:
            import logging
            logging.getLogger(__name__).warning(
                '[SalesAuditLog] Failed to write audit entry for order %s', order.id,
                exc_info=True
            )
            return None
