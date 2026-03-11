from erp.models import User
"""
Workspace Module Models
Task management, checklists, KPIs, questionnaires, and employee performance.
"""
from django.db import models
from django.utils import timezone
from decimal import Decimal
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.events import emit_event


# =============================================================================
# WORKSPACE CONFIGURATION
# =============================================================================

class WorkspaceConfig(TenantOwnedModel):
    """
    Per-organization configuration for the Workspace module.
    Allows customizing task labels, colors, and performance scoring.
    """
    # Task Statuses: CODE -> { label, color, icon }
    task_statuses = models.JSONField(
        default=dict, blank=True,
        help_text='JSON: {"PENDING": {"label": "Pending", "color": "#94a3b8"}, ...}'
    )
    # Task Priorities: CODE -> { label, color, multiplier }
    task_priorities = models.JSONField(
        default=dict, blank=True,
        help_text='JSON: {"URGENT": {"label": "Urgent", "color": "#ef4444", "multiplier": 2.0}, ...}'
    )
    # KPI Weights (Replaces old KPIConfig)
    task_completion_weight = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('30.00'))
    on_time_weight = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('25.00'))
    checklist_weight = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('20.00'))
    evaluation_weight = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('25.00'))
    
    # Tier thresholds (percentage-based)
    bronze_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('40.00'))
    silver_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('60.00'))
    gold_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('80.00'))
    platinum_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('90.00'))

    # Checklist Triggers: CODE -> label
    checklist_triggers = models.JSONField(
        default=dict, blank=True,
        help_text='JSON: {"SHIFT_START": "Start of Shift", ...}'
    )
    # Employee Request Types: CODE -> label
    request_types = models.JSONField(
        default=dict, blank=True,
        help_text='JSON: {"EXPENSE": "Expense Claim", ...}'
    )

    # Feature Toggles
    enable_auto_tasks = models.BooleanField(default=True)
    enable_checklists = models.BooleanField(default=True)
    enable_performance_scoring = models.BooleanField(default=True)

    class Meta:
        db_table = 'workspace_config'
        verbose_name = 'Workspace Configuration'
        verbose_name_plural = 'Workspace Configurations'

    @classmethod
    def get_config(cls, organization):
        config, created = cls.objects.get_or_create(organization=organization)
        if created:
            # Seed with default values
            config.task_statuses = {
                'PENDING': {'label': 'Pending', 'color': '#94a3b8', 'icon': 'Clock'},
                'IN_PROGRESS': {'label': 'In Progress', 'color': '#6366f1', 'icon': 'Play'},
                'AWAITING_RESPONSE': {'label': 'Awaiting Response', 'color': '#f59e0b', 'icon': 'HelpCircle'},
                'COMPLETED': {'label': 'Completed', 'color': '#22c55e', 'icon': 'CheckCircle'},
                'CANCELLED': {'label': 'Cancelled', 'color': '#ef4444', 'icon': 'XCircle'},
                'OVERDUE': {'label': 'Overdue', 'color': '#f43f5e', 'icon': 'AlertTriangle'},
            }
            config.task_priorities = {
                'LOW': {'label': 'Low', 'color': '#94a3b8', 'multiplier': 0.5},
                'MEDIUM': {'label': 'Medium', 'color': '#6366f1', 'multiplier': 1.0},
                'HIGH': {'label': 'High', 'color': '#f59e0b', 'multiplier': 1.5},
                'URGENT': {'label': 'Urgent', 'color': '#ef4444', 'multiplier': 2.0},
            }
            config.checklist_triggers = {
                'SHIFT_START': 'Start of Shift',
                'SHIFT_MID': 'Mid-Shift',
                'SHIFT_END': 'End of Shift',
                'DAILY': 'Daily',
                'WEEKLY': 'Weekly',
                'CUSTOM': 'Custom / On Demand',
            }
            config.request_types = {
                'SUGGESTION': 'General Suggestion',
                'MAINTENANCE': 'Maintenance Issue',
                'COMPLAINT': 'Workplace Complaint',
                'ABSENCE': 'Planned Absence',
                'OVERTIME': 'Overtime Claim',
            }
            config.save()
        return config


# =============================================================================
# TASK MANAGEMENT
# =============================================================================

SOURCE_CHOICES = (
    ('MANUAL', 'Manual'),
    ('SYSTEM', 'System Generated'),
    ('RECURRING', 'Recurring Instance'),
    ('REPLY', 'Task Response'),
)


class TaskCategory(TenantOwnedModel):
    """Categories for organizing tasks (e.g. Inventory, Finance, HR)."""
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default='#6366f1', help_text='Hex color code')
    icon = models.CharField(max_length=50, null=True, blank=True, help_text='Lucide icon name')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'workspace_task_category'
        unique_together = ('tenant', 'name')
        verbose_name_plural = 'Task Categories'

    def __str__(self):
        return self.name


class TaskTemplate(TenantOwnedModel):
    """
    Reusable task blueprints for recurring or auto-generated tasks.
    Defines default values for task creation.
    """
    name = models.CharField(max_length=200)
    default_priority = models.CharField(max_length=20, default='MEDIUM', help_text='Internal priority code')
    default_points = models.IntegerField(default=1, help_text='Points earned on completion')
    estimated_minutes = models.IntegerField(default=30, help_text='Estimated time in minutes')
    # Recurrence
    is_recurring = models.BooleanField(default=False)
    recurrence_rule = models.CharField(
        max_length=20, null=True, blank=True,
        help_text='DAILY, WEEKLY, MONTHLY, or cron-like expression'
    )
    recurrence_time = models.TimeField(null=True, blank=True, help_text='Time of day to create task')
    # Assignment
    assign_to_role = models.ForeignKey(
        'erp.Role', on_delete=models.SET_NULL, null=True, blank=True,
        help_text='Auto-assign to users with this role'
    )
    assign_to_department = models.IntegerField(
        null=True, blank=True,
        help_text='Department ID — decoupled from HR module'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'workspace_task_template'

    def __str__(self):
        return self.name


class AutoTaskRule(TenantOwnedModel):
    """
    Rules for automatic task generation from system events OR recurring schedules.
    Supports:
    - Event-based: fires when a system event occurs (e.g., price change, purchase entered)
    - Time-based: fires on a schedule (daily, weekly, monthly)
    - Task chains: fire when a parent task is completed
    """
    # ── Rule Type ────────────────────────────────────────────────────────────
    RULE_TYPE_CHOICES = (
        ('EVENT', 'Event-Based'),
        ('RECURRING', 'Time-Based Recurring'),
    )
    rule_type = models.CharField(max_length=10, choices=RULE_TYPE_CHOICES, default='EVENT')

    # ── Module Grouping ──────────────────────────────────────────────────────
    MODULE_CHOICES = (
        ('inventory', 'Inventory'),
        ('purchasing', 'Purchasing'),
        ('finance', 'Finance'),
        ('crm', 'CRM'),
        ('sales', 'Sales / POS'),
        ('hr', 'HR'),
        ('system', 'System / Admin'),
    )
    module = models.CharField(max_length=20, choices=MODULE_CHOICES, default='system')
    code = models.CharField(
        max_length=10, null=True, blank=True,
        help_text='Rule code e.g. INV-01, PUR-03. Unique per organization.'
    )

    # ── Trigger Events ───────────────────────────────────────────────────────
    TRIGGER_CHOICES = (
        # ── Inventory ──
        ('PRICE_CHANGE',            'Product Price Changed'),
        ('LOW_STOCK',               'Low Stock Alert'),
        ('EXPIRY_APPROACHING',      'Product Expiry Approaching'),
        ('PRODUCT_EXPIRED',         'Product Has Expired'),
        ('PRODUCT_CREATED',         'New Product Created'),
        ('BARCODE_MISSING_PURCHASE', 'Product Purchased Without Barcode'),
        ('BARCODE_MISSING_TRANSFER', 'Product Transferred Without Barcode'),
        ('BARCODE_DAILY_CHECK',     'Daily: Products Without Barcodes'),
        ('STOCK_ADJUSTMENT',        'Stock Adjustment Made'),
        ('INVENTORY_COUNT',         'Inventory Count Needed'),
        ('NEGATIVE_STOCK',          'Negative Stock Sale'),

        # ── Purchasing ──
        ('PURCHASE_ENTERED',        'Purchase Order Entered'),
        ('PURCHASE_NO_ATTACHMENT',  'Purchase Without Invoice Attachment'),
        ('PO_APPROVED',             'Purchase Order Approved'),
        ('RECEIPT_VOUCHER',         'Receipt Voucher Arrived'),
        ('PROFORMA_RECEIVED',       'Proforma Received'),
        ('TRANSFER_CREATED',        'Transfer Order Created'),
        ('DELIVERY_COMPLETED',      'Delivery Completed'),
        ('NEW_SUPPLIER',            'New Supplier Onboarded'),

        # ── Finance / POS ──
        ('CREDIT_SALE',             'Credit Sale — No Cash Collected'),
        ('HIGH_VALUE_SALE',         'High-Value Sale Threshold Crossed'),
        ('ORDER_COMPLETED',         'Order Completed'),
        ('POS_RETURN',              'POS Return / Refund Processed'),
        ('CASHIER_DISCOUNT',        'Cashier Applied Discount'),
        ('OVERDUE_INVOICE',         'Invoice Overdue'),
        ('LATE_PAYMENT',            'Late Payment Detected'),
        ('PAYMENT_DUE_SUPPLIER',    'Supplier Payment Due'),
        ('NEW_INVOICE',             'New Invoice Received'),
        ('BANK_STATEMENT',          'Bank Statement Received'),
        ('DAILY_SUMMARY',           'End-of-Day Financial Summary'),
        ('MONTH_END',               'Month-End Close'),

        # ── CRM ──
        ('PROMOTION_TRIGGERED',     'Targeted Client Promotion'),
        ('EXTERNAL_DOCUMENT_SEND',  'Send Document to Client/Supplier'),
        ('CLIENT_FOLLOWUP_DUE',     'Client Follow-Up Strategy Due'),
        ('SUPPLIER_FOLLOWUP_DUE',   'Supplier Follow-Up Due'),
        ('NEW_CLIENT',              'New Client Registered'),
        ('CLIENT_INACTIVE',         'Client Inactive > X Days'),
        ('CLIENT_COMPLAINT',        'Client Complaint Filed'),
        ('ADDRESS_BOOK_VERIFY',     'Address Book Verification'),

        # ── HR ──
        ('EMPLOYEE_ONBOARD',        'New Employee Onboarded'),
        ('LEAVE_REQUEST',           'Leave Request Submitted'),
        ('ATTENDANCE_ANOMALY',      'Attendance Anomaly Detected'),

        # ── System ──
        ('USER_REGISTRATION',       'New User Registration'),
        ('REPORT_NEEDS_REVIEW',     'Report Needs Review'),
        ('ORDER_STALE',             'Order Not Treated After X Days'),
        ('APPROVAL_PENDING',        'Approval Pending > X Days'),

        # ── Custom ──
        ('CUSTOM',                  'Custom Event'),
    )

    name = models.CharField(max_length=200)
    trigger_event = models.CharField(max_length=30, choices=TRIGGER_CHOICES)
    custom_event_code = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Event code for CUSTOM trigger type'
    )

    template = models.ForeignKey(TaskTemplate, on_delete=models.CASCADE, related_name='auto_rules')

    # ── Conditions ───────────────────────────────────────────────────────────
    # Filter by amount, site, client, cashier, payment_method, or any combo
    # e.g. {"min_amount": 500000, "site_id": 3, "client_id": 12, "stale_days": 3}
    conditions = models.JSONField(
        default=dict, blank=True,
        help_text='Conditions: min_amount, max_amount, site_id, client_id, cashier_id, payment_method, stale_days'
    )

    # ── Recurrence (for RECURRING type) ──────────────────────────────────────
    INTERVAL_CHOICES = (
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
    )
    recurrence_interval = models.CharField(
        max_length=10, choices=INTERVAL_CHOICES, null=True, blank=True,
        help_text='How often to fire (for RECURRING rules)'
    )
    recurrence_time = models.TimeField(
        null=True, blank=True,
        help_text='What time of day to fire (e.g. 08:00)'
    )
    recurrence_day_of_week = models.IntegerField(
        null=True, blank=True,
        help_text='0=Monday, 6=Sunday (for WEEKLY rules)'
    )
    recurrence_day_of_month = models.IntegerField(
        null=True, blank=True,
        help_text='1-28 (for MONTHLY rules). Use 28 for end-of-month.'
    )
    last_fired_at = models.DateTimeField(null=True, blank=True)

    # ── Task Chain ───────────────────────────────────────────────────────────
    chain_parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='chain_children',
        help_text='Only fire when this parent rule\'s task is COMPLETED'
    )
    chain_delay_minutes = models.IntegerField(
        default=0,
        help_text='Wait X minutes after parent task completes before creating this task'
    )

    # ── Assignment ───────────────────────────────────────────────────────────
    assign_to_user = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='auto_task_rules_assigned',
        help_text='Assign generated task to this specific user (overrides role)'
    )
    broadcast_to_role = models.BooleanField(
        default=False,
        help_text='If True, create a task for EVERY user in the assigned role'
    )

    # ── Priority Override ────────────────────────────────────────────────────
    priority = models.CharField(
        max_length=20, null=True, blank=True,
        help_text='Override the template default priority (URGENT, HIGH, MEDIUM, LOW)'
    )

    # ── Stale Threshold (for ORDER_STALE, APPROVAL_PENDING triggers) ────────
    stale_threshold_days = models.IntegerField(
        default=3,
        help_text='Number of days after which to trigger (for stale/overdue rules)'
    )

    is_active = models.BooleanField(default=True)
    is_system_default = models.BooleanField(
        default=False,
        help_text='True if this is a pre-seeded system default (user can disable but not delete)'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'workspace_auto_task_rule'
        indexes = [
            models.Index(fields=['module', 'is_active']),
            models.Index(fields=['rule_type', 'is_active']),
            models.Index(fields=['trigger_event']),
        ]

    def __str__(self):
        prefix = f"[{self.code}] " if self.code else ""
        return f"{prefix}{self.name} ({self.get_trigger_event_display()})"



class Task(TenantOwnedModel):
    """
    Core task model with full lifecycle.
    Supports hierarchy (higher→lower), bidirectional flow (replies go back up),
    and recurring instances.
    """
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default='PENDING', help_text='Internal status code')
    priority = models.CharField(max_length=20, default='MEDIUM', help_text='Internal priority code')
    source = models.CharField(max_length=15, choices=SOURCE_CHOICES, default='MANUAL')

    # Link to category & template
    category = models.ForeignKey(
        TaskCategory, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tasks'
    )
    template = models.ForeignKey(
        TaskTemplate, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='instances'
    )
    auto_rule = models.ForeignKey(
        AutoTaskRule, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='generated_tasks'
    )

    # Assignment (Higher → Lower)
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tasks_assigned'
    )
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tasks_received'
    )
    assigned_to_group = models.ForeignKey(
        'erp.Role', on_delete=models.SET_NULL, null=True, blank=True,
        help_text='Assign to all users with this role'
    )

    # Parent task (for subtasks)
    parent_task = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='subtasks'
    )

    # Points & scoring
    points = models.IntegerField(default=1, help_text='Points earned on completion')
    estimated_minutes = models.IntegerField(default=30)

    # Dates
    due_date = models.DateTimeField(null=True, blank=True)
    reminder_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    # Context reference (e.g. "Invoice #123" or "Product SKU-456")
    related_object_type = models.CharField(max_length=50, null=True, blank=True)
    related_object_id = models.IntegerField(null=True, blank=True)
    related_object_label = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'workspace_task'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'assigned_to']),
            models.Index(fields=['due_date']),
        ]

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        if self.due_date and self.status not in ('COMPLETED', 'CANCELLED'):
            return timezone.now() > self.due_date
        return False

    def start(self):
        self.status = 'IN_PROGRESS'
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at', 'updated_at'])

    def complete(self):
        self.status = 'COMPLETED'
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at', 'updated_at'])
        # ── WISE Integration: Score the assignee based on timeliness ─────────
        self._score_completion()
        # ── Task Chain: Fire child rules when this task's rule has chain children ──
        self._fire_chain_children()

    def _score_completion(self):
        """
        Emit a WISE score event for the assigned user on task completion.
        Timeliness is judged against the due_date.
        """
        try:
            if not self.assigned_to:
                return
            employee = getattr(self.assigned_to, 'employee', None)

            if self.due_date and self.completed_at:
                if self.completed_at <= self.due_date:
                    event_code  = 'task_completed_early'
                    is_on_time  = True
                else:
                    event_code  = 'task_overdue'
                    is_on_time  = False
            else:
                event_code  = 'task_completed_early'
                is_on_time  = True

            # 1. Emit the kernel event for any cross-module subscribers
            from kernel.events import emit_event
            emit_event('task.completed', {
                'task_id':          self.id,
                'task_title':       self.title,
                'assignee_user_id': self.assigned_to_id,
                'employee_id':      employee.id if employee else None,
                'is_on_time':       is_on_time,
                'due_date':         self.due_date.isoformat() if self.due_date else None,
                'completed_at':     self.completed_at.isoformat() if self.completed_at else None,
                'tenant_id':        self.tenant_id,
            }, aggregate_type='task', aggregate_id=self.id)

            # 2. Direct WISE score (fast path — avoids event roundtrip for the user's own score)
            if employee:
                from apps.workforce.services import WorkforceScoreEngine
                WorkforceScoreEngine.record_event(
                    employee=employee,
                    event_code=event_code,
                    module='workspace',
                    reference_obj=self,
                    metadata={'task_title': self.title, 'task_id': self.id}
                )
        except Exception:
            pass  # WISE scoring must never crash the caller

    def cancel(self):
        self.status = 'CANCELLED'
        self.save(update_fields=['status', 'updated_at'])

    def _fire_chain_children(self):
        """When this task completes, fire any chain-child rules."""
        if not self.auto_rule_id:
            return
        try:
            children = AutoTaskRule.objects.filter(
                chain_parent=self.auto_rule,
                is_active=True,
            ).select_related('template')
            for child_rule in children:
                Task.objects.create(
                    organization=self.organization,
                    title=f"🔗 {child_rule.template.name}" if child_rule.template else f"Chain: {child_rule.name}",
                    description=f"Auto-created after completing: {self.title}\nChain rule: {child_rule.name}",
                    priority=child_rule.priority or child_rule.template.default_priority or 'MEDIUM',
                    status='PENDING',
                    source='SYSTEM',
                    auto_rule=child_rule,
                    template=child_rule.template,
                    assigned_to=child_rule.assign_to_user or None,
                    assigned_to_group=child_rule.template.assign_to_role if not child_rule.assign_to_user else None,
                    parent_task=self,
                    related_object_type=self.related_object_type,
                    related_object_id=self.related_object_id,
                    related_object_label=self.related_object_label,
                    points=child_rule.template.default_points or 1,
                    estimated_minutes=child_rule.template.estimated_minutes or 30,
                )
        except Exception:
            pass  # Never crash the caller



class TaskComment(TenantOwnedModel):
    """
    Comments / replies on tasks.
    Supports bidirectional flow: lower replies to higher and vice versa.
    """
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    content = models.TextField()
    is_response = models.BooleanField(
        default=False,
        help_text='True if this is a response flowing back UP the hierarchy'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'workspace_task_comment'
        ordering = ['created_at']

    def __str__(self):
        return f"Comment on {self.task.title} by {self.author}"


class TaskAttachment(TenantOwnedModel):
    """File attachments on tasks."""
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='workspace/attachments/')
    filename = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'workspace_task_attachment'

    def __str__(self):
        return self.filename


class EmployeeRequest(TenantOwnedModel):
    """
    Requests/suggestions from lower to higher in the hierarchy.
    These are NOT direct tasks — they require approval to become tasks.
    """
    title = models.CharField(max_length=300)
    description = models.TextField(null=True, blank=True)
    request_type = models.CharField(max_length=30, default='SUGGESTION', help_text='Internal request type code')
    status = models.CharField(max_length=20, default='PENDING', help_text='Internal status code')
    requested_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='employee_requests'
    )
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_requests'
    )
    resulting_task = models.ForeignKey(
        Task, on_delete=models.SET_NULL, null=True, blank=True,
        help_text='Task created if request is approved'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'workspace_employee_request'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.get_request_type_display()})"

    def approve(self, reviewer):
        self.status = 'APPROVED'
        self.reviewed_by = reviewer
        self.reviewed_at = timezone.now()
        self.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])

    def reject(self, reviewer):
        self.status = 'REJECTED'
        self.reviewed_by = reviewer
        self.reviewed_at = timezone.now()
        self.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])


# =============================================================================
# CHECKLISTS
# =============================================================================

class ChecklistTemplate(TenantOwnedModel):
    """
    Reusable checklist blueprints (e.g. Start of Shift, End of Shift).
    """
    name = models.CharField(max_length=200)
    trigger = models.CharField(max_length=30, default='CUSTOM', help_text='Internal trigger code')
    assign_to_role = models.ForeignKey(
        'erp.Role', on_delete=models.SET_NULL, null=True, blank=True,
        help_text='Auto-assign to users with this role'
    )
    points = models.IntegerField(default=5, help_text='Points for completing the full checklist')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'workspace_checklist_template'

    def __str__(self):
        return f"{self.name} ({self.get_trigger_display()})"


class ChecklistTemplateItem(TenantOwnedModel):
    """Individual items within a checklist template."""
    template = models.ForeignKey(
        ChecklistTemplate, on_delete=models.CASCADE, related_name='items'
    )
    label = models.CharField(max_length=300)
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=0)
    is_required = models.BooleanField(default=True)

    class Meta:
        db_table = 'workspace_checklist_template_item'
        ordering = ['order']

    def __str__(self):
        return f"{self.order}. {self.label}"


class ChecklistInstance(TenantOwnedModel):
    """An assigned checklist to a specific employee for a specific date/shift."""
    template = models.ForeignKey(ChecklistTemplate, on_delete=models.CASCADE, related_name='instances')
    assigned_to = models.ForeignKey(User, on_delete=models.CASCADE, related_name='checklists')
    date = models.DateField()
    status = models.CharField(max_length=20, default='PENDING', help_text='Internal status code')
    completed_at = models.DateTimeField(null=True, blank=True)
    points_earned = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'workspace_checklist_instance'
        ordering = ['-date']

    def __str__(self):
        return f"{self.template.name} — {self.assigned_to} ({self.date})"

    def check_completion(self):
        """Check if all required items are done and update status."""
        required = self.item_responses.filter(template_item__is_required=True)
        if required.exists() and all(r.is_checked for r in required):
            self.status = 'COMPLETED'
            self.completed_at = timezone.now()
            self.points_earned = self.template.points
            self.save(update_fields=['status', 'completed_at', 'points_earned'])


class ChecklistItemResponse(TenantOwnedModel):
    """Employee response to a single checklist item."""
    instance = models.ForeignKey(
        ChecklistInstance, on_delete=models.CASCADE, related_name='item_responses'
    )
    template_item = models.ForeignKey(ChecklistTemplateItem, on_delete=models.CASCADE)
    is_checked = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'workspace_checklist_item_response'
        unique_together = ('instance', 'template_item')

    def __str__(self):
        status = '✅' if self.is_checked else '⬜'
        return f"{status} {self.template_item.label}"


# =============================================================================
# QUESTIONNAIRES & EVALUATIONS
# =============================================================================

class Questionnaire(TenantOwnedModel):
    """Evaluation questionnaire template configured by organization."""
    FREQUENCY_CHOICES = (
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('ANNUAL', 'Annual'),
        ('CUSTOM', 'Custom'),
    )
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='MONTHLY')
    assign_to_role = models.ForeignKey(
        'erp.Role', on_delete=models.SET_NULL, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'workspace_questionnaire'

    def __str__(self):
        return self.name


class QuestionnaireQuestion(TenantOwnedModel):
    """Individual question in a questionnaire."""
    QUESTION_TYPES = (
        ('RATING', 'Rating (1-5)'),
        ('TEXT', 'Free Text'),
        ('YESNO', 'Yes / No'),
        ('CHOICE', 'Multiple Choice'),
    )
    questionnaire = models.ForeignKey(
        Questionnaire, on_delete=models.CASCADE, related_name='questions'
    )
    question_text = models.CharField(max_length=500)
    question_type = models.CharField(max_length=10, choices=QUESTION_TYPES, default='RATING')
    choices = models.JSONField(
        default=list, blank=True,
        help_text='Options for CHOICE type, e.g. ["Good", "Fair", "Poor"]'
    )
    max_score = models.IntegerField(default=5)
    order = models.IntegerField(default=0)
    is_required = models.BooleanField(default=True)

    class Meta:
        db_table = 'workspace_questionnaire_question'
        ordering = ['order']

    def __str__(self):
        return self.question_text


class QuestionnaireResponse(TenantOwnedModel):
    """A completed questionnaire from an evaluator for a specific employee."""
    questionnaire = models.ForeignKey(Questionnaire, on_delete=models.CASCADE)
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='questionnaire_evaluations')
    evaluator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='evaluations_given')
    period_label = models.CharField(max_length=50, null=True, blank=True, help_text='e.g. "2026-Q1", "Jan 2026"')
    total_score = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    max_possible_score = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    score_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    submitted_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'workspace_questionnaire_response'
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.questionnaire.name} — {self.employee} ({self.score_percentage}%)"

    def calculate_score(self):
        """Recalculate total score from individual answers."""
        answers = self.answers.all()
        self.total_score = sum(a.score for a in answers)
        self.max_possible_score = sum(a.question.max_score for a in answers)
        if self.max_possible_score > 0:
            self.score_percentage = (self.total_score / self.max_possible_score) * 100
        self.save(update_fields=['total_score', 'max_possible_score', 'score_percentage'])


class QuestionnaireAnswer(TenantOwnedModel):
    """Individual answer to a question within a response."""
    response = models.ForeignKey(
        QuestionnaireResponse, on_delete=models.CASCADE, related_name='answers'
    )
    question = models.ForeignKey(QuestionnaireQuestion, on_delete=models.CASCADE)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    text_answer = models.TextField(null=True, blank=True)
    choice_answer = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        db_table = 'workspace_questionnaire_answer'
        unique_together = ('response', 'question')

    def __str__(self):
        return f"Q: {self.question.question_text[:50]} → {self.score}"


class EmployeePerformance(TenantOwnedModel):
    """Monthly performance score for an employee."""
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='performance_records')
    period_label = models.CharField(max_length=50) # e.g. "2026-02"
    
    overall_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tier = models.CharField(max_length=20, null=True, blank=True) # BRONZE, SILVER, GOLD, PLATINUM
    
    class Meta:
        db_table = 'workspace_employee_performance'
        unique_together = ('tenant', 'employee', 'period_label')

    def calculate_tier(self, config=None):
        """Determine performance tier from overall_score using WorkspaceConfig thresholds."""
        if not config:
            config = WorkspaceConfig.get_config(self.organization)
        if not config:
            return
        score = float(self.overall_score)
        if score >= float(config.platinum_threshold):
            self.tier = 'PLATINUM'
        elif score >= float(config.gold_threshold):
            self.tier = 'GOLD'
        elif score >= float(config.silver_threshold):
            self.tier = 'SILVER'
        elif score >= float(config.bronze_threshold):
            self.tier = 'BRONZE'
        else:
            self.tier = None
        self.save(update_fields=['tier'])