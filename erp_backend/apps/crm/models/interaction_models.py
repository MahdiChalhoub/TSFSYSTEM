from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.config import get_config

class RelationshipAssignment(AuditLogMixin, TenantOwnedModel):
    """
    Defines who owns the relationship with a contact/supplier/customer.
    Allows for primary owners, backups, and role-based assignments.
    """
    ENTITY_TYPES = get_config('crm_entity_types', default=(
        ("CONTACT", "Contact"),
        ("SUPPLIER", "Supplier"),
        ("CUSTOMER", "Customer"),
    ))
    PRIORITY_LEVELS = get_config('crm_priority_levels', default=(
        ("LOW", "Low"),
        ("NORMAL", "Normal"),
        ("HIGH", "High"),
        ("STRATEGIC", "Strategic"),
    ))

    entity_type = models.CharField(max_length=20, choices=ENTITY_TYPES)
    contact = models.ForeignKey("crm.Contact", on_delete=models.CASCADE, related_name="assignments")
    
    # Branch scope
    branch = models.ForeignKey("inventory.Warehouse", on_delete=models.SET_NULL, null=True, blank=True)

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="owned_relationships",
        help_text="The user responsible for this relationship"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name="created_relationship_assignments"
    )

    role = models.CharField(max_length=50, blank=True, help_text="e.g., Account Manager, Purchasing Officer, Sales Rep")
    priority = models.CharField(max_length=20, choices=PRIORITY_LEVELS, default="NORMAL")

    is_primary = models.BooleanField(default=True)
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_relationship_assignment'
        ordering = ['-is_active', '-is_primary', 'priority']

    def __str__(self):
        return f"{self.contact.name} assigned to {self.assigned_to.username} ({self.role})"


class FollowUpPolicy(AuditLogMixin, TenantOwnedModel):
    """
    Automation logic for interactions. Defines 'Heartbeat' cadence for calling, visiting, or reordering.
    """
    ACTION_TYPES = get_config('crm_action_types', default=(
        ("CALL", "Call"),
        ("VISIT", "Visit"),
        ("WHATSAPP", "WhatsApp"),
        ("EMAIL", "Email"),
        ("MEETING", "Meeting"),
        ("REORDER_REVIEW", "Reorder Review"),
        ("PAYMENT_FOLLOWUP", "Payment Follow-up"),
    ))

    TRIGGER_TYPES = get_config('crm_trigger_types', default=(
        ("FIXED_INTERVAL", "Fixed Interval"),
        ("STOCK_LEVEL", "Stock Level"),
        ("NO_ORDER_SINCE", "No Order Since"),
        ("NO_INTERACTION_SINCE", "No Interaction Since"),
        ("EXPIRY_WINDOW", "Expiry Window"),
        ("MANUAL", "Manual"),
    ))

    contact = models.ForeignKey("crm.Contact", on_delete=models.CASCADE, related_name="followup_policies")
    branch = models.ForeignKey("inventory.Warehouse", on_delete=models.SET_NULL, null=True, blank=True, help_text="Scope to a specific branch")

    name = models.CharField(max_length=120)
    action_type = models.CharField(max_length=30, choices=ACTION_TYPES)
    trigger_type = models.CharField(max_length=30, choices=TRIGGER_TYPES)

    # Interval configuration
    interval_days = models.PositiveIntegerField(null=True, blank=True, help_text="Frequency in days")
    lead_days = models.PositiveIntegerField(default=0, help_text="Days before due date to create the task")
    preferred_weekday = models.PositiveIntegerField(
        null=True, blank=True, 
        choices=[(0, "Monday"), (1, "Tuesday"), (2, "Wednesday"), (3, "Thursday"), (4, "Friday"), (5, "Saturday"), (6, "Sunday")]
    )
    preferred_time = models.TimeField(null=True, blank=True)

    # Trigger-specific parameters
    stock_threshold = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    no_order_days = models.PositiveIntegerField(null=True, blank=True)
    no_interaction_days = models.PositiveIntegerField(null=True, blank=True)

    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    is_mandatory = models.BooleanField(default=False)
    auto_create_next = models.BooleanField(default=True, help_text="Automatically create next recurring activity upon completion")
    active = models.BooleanField(default=True)

    priority = models.CharField(max_length=20, default="NORMAL")
    notes_template = models.TextField(blank=True, help_text="Pre-fill activity notes with this template")
    
    # Task/Reminder automation configuration
    auto_create_task = models.BooleanField(default=True)
    auto_create_reminder = models.BooleanField(default=True)
    reminder_offset_value = models.PositiveIntegerField(default=1)
    reminder_offset_unit = models.CharField(
        max_length=10,
        choices=[("MINUTE", "Minute"), ("HOUR", "Hour"), ("DAY", "Day")],
        default="DAY"
    )
    auto_schedule_next_from = models.CharField(
        max_length=20,
        choices=[("DUE_DATE", "Due Date"), ("COMPLETION_DATE", "Completion Date")],
        default="COMPLETION_DATE"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_followup_policy'

    def __str__(self):
        return f"{self.name} ({self.get_action_type_display()})"


class ScheduledActivity(AuditLogMixin, TenantOwnedModel):
    """
    The actual 'Work Queue' item. Represents an intended future action.
    """
    STATUS_CHOICES = [
        ("PLANNED", "Planned"),
        ("DUE", "Due"),
        ("OVERDUE", "Overdue"),
        ("DONE", "Done"),
        ("CANCELLED", "Cancelled"),
        ("SKIPPED", "Skipped"),
        ("RESCHEDULED", "Rescheduled"),
    ]

    ACTION_TYPES = FollowUpPolicy.ACTION_TYPES
    SOURCE_TYPES = get_config('crm_source_types', default=(
        ("POLICY", "Policy"),
        ("MANUAL", "Manual"),
        ("SYSTEM", "System"),
        ("COMPLIANCE", "Compliance"),
        ("SALES", "Sales"),
        ("PROCUREMENT", "Procurement"),
    ))

    contact = models.ForeignKey("crm.Contact", on_delete=models.CASCADE, related_name="activities")
    followup_policy = models.ForeignKey(FollowUpPolicy, on_delete=models.SET_NULL, null=True, blank=True)

    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="scheduled_activities")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_scheduled_activities")

    action_type = models.CharField(max_length=30, choices=ACTION_TYPES)
    source_type = models.CharField(max_length=30, choices=SOURCE_TYPES)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    scheduled_for = models.DateTimeField()
    due_date = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)

    priority = models.CharField(max_length=20, default="NORMAL")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PLANNED")

    is_auto_generated = models.BooleanField(default=True)
    requires_note = models.BooleanField(default=False)
    
    # Recurrence & Lifecycle tracking
    is_recurring = models.BooleanField(default=False)
    recurrence_key = models.CharField(max_length=100, blank=True, help_text="Unique key to identify a chain of recurring tasks")
    
    last_reminder_at = models.DateTimeField(null=True, blank=True)
    next_reminder_at = models.DateTimeField(null=True, blank=True)
    overdue_since = models.DateTimeField(null=True, blank=True)
    postponed_count = models.PositiveIntegerField(default=0)
    completion_note = models.TextField(blank=True)
    reschedule_reason = models.TextField(blank=True)
    manager_notified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_scheduled_activity'
        ordering = ['due_date', 'priority']

    def __str__(self):
        return f"{self.get_action_type_display()} - {self.contact.name} ({self.status})"


class ActivityReminder(AuditLogMixin, TenantOwnedModel):
    """
    Specific alert records for scheduled activities.
    """
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("SENT", "Sent"),
        ("FAILED", "Failed"),
        ("CANCELLED", "Cancelled"),
    ]
    CHANNEL_CHOICES = [
        ("IN_APP", "In App"),
        ("EMAIL", "Email"),
        ("SMS", "SMS"),
        ("WHATSAPP", "WhatsApp"),
        ("PUSH", "Push"),
    ]

    scheduled_activity = models.ForeignKey(ScheduledActivity, on_delete=models.CASCADE, related_name="reminders")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activity_reminders")
    
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default="IN_APP")
    remind_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    
    message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    is_auto_generated = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_activity_reminder'
        ordering = ['remind_at']


class InteractionLog(AuditLogMixin, TenantOwnedModel):
    """
    Auditable history of actual touches and events.
    """
    CHANNELS = get_config('crm_interaction_channels', default=(
        ("CALL", "Call"),
        ("VISIT", "Visit"),
        ("WHATSAPP", "WhatsApp"),
        ("EMAIL", "Email"),
        ("MEETING", "Meeting"),
        ("SYSTEM", "System"),
        ("ORDER", "Order"),
    ))
    OUTCOMES = get_config('crm_interaction_outcomes', default=(
        ("SUCCESS", "Success"),
        ("NO_ANSWER", "No Answer"),
        ("POSTPONED", "Postponed"),
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed"),
        ("ORDER_CONFIRMED", "Order Confirmed"),
        ("FOLLOW_UP_REQUIRED", "Follow-up Required"),
    ))

    contact = models.ForeignKey("crm.Contact", on_delete=models.CASCADE, related_name="interactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    channel = models.CharField(max_length=20, choices=CHANNELS)
    outcome = models.CharField(max_length=30, choices=OUTCOMES)

    subject = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    interaction_at = models.DateTimeField(default=timezone.now)
    
    # Optional scheduling for next action directly from the log
    next_action_type = models.CharField(max_length=30, blank=True)
    next_action_at = models.DateTimeField(null=True, blank=True)

    # Cross-module context
    related_order_id = models.CharField(max_length=50, null=True, blank=True) 
    related_invoice_id = models.CharField(max_length=50, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_interaction_log'
        ordering = ['-interaction_at']


class SupplierProductPolicy(AuditLogMixin, TenantOwnedModel):
    """
    Granular reorder logic at the supplier-product level.
    Used to drive Automated Purchasing reviews.
    """
    REORDER_MODES = get_config('crm_reorder_modes', default=(
        ("FIXED_DAYS", "Fixed Days"),
        ("MIN_STOCK", "Minimum Stock"),
        ("SALES_VELOCITY", "Sales Velocity"),
        ("MANUAL", "Manual"),
    ))

    supplier = models.ForeignKey("crm.Contact", on_delete=models.CASCADE, related_name="supplier_product_policies")
    product = models.ForeignKey("inventory.Product", on_delete=models.CASCADE)
    branch = models.ForeignKey("inventory.Warehouse", on_delete=models.SET_NULL, null=True, blank=True)

    reorder_mode = models.CharField(max_length=30, choices=REORDER_MODES, default="MIN_STOCK")

    review_every_days = models.PositiveIntegerField(null=True, blank=True)
    min_stock_level = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    safety_stock = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    lead_time_days = models.PositiveIntegerField(default=0)
    preferred_supplier = models.BooleanField(default=False)

    assigned_buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_supplier_product_policy'
        unique_together = ['tenant', 'supplier', 'product', 'branch']
