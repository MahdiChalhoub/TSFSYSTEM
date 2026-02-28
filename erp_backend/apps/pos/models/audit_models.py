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
