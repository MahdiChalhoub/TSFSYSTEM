from django.db import models
from django.utils import timezone
from decimal import Decimal
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils.translation import gettext_lazy as _
from erp.models import TenantModel, User
# Note: Employee and Department are referenced via string-based FKs ('hr.Employee', 'hr.Department')
# to avoid direct cross-module imports — Connector Governance Layer compliance.
# Note: Branch usually comes from erp.models.Organization (as sites) or a dedicated Branch model.
# In TSFSYSTEM, "Site" is often used for Branch.
from erp.models import Site

class ScoreFamily(models.TextChoices):
    PERFORMANCE = 'PERFORMANCE', _('Performance')
    TRUST = 'TRUST', _('Trust')
    COMPLIANCE = 'COMPLIANCE', _('Compliance')
    RELIABILITY = 'RELIABILITY', _('Reliability')
    LEADERSHIP = 'LEADERSHIP', _('Leadership')
    RISK = 'RISK', _('Risk')

class ScoreDimension(models.TextChoices):
    PRODUCTIVITY = 'PRODUCTIVITY', _('Productivity')
    ACCURACY = 'ACCURACY', _('Accuracy')
    TIMELINESS = 'TIMELINESS', _('Timeliness')
    COMPLIANCE = 'COMPLIANCE', _('Compliance')
    CUSTOMER_IMPACT = 'CUSTOMER_IMPACT', _('Customer Impact')
    TEAMWORK = 'TEAMWORK', _('Teamwork')
    LEADERSHIP = 'LEADERSHIP', _('Leadership')
    FINANCIAL_DISCIPLINE = 'FINANCIAL_DISCIPLINE', _('Financial Discipline')
    INVENTORY_DISCIPLINE = 'INVENTORY_DISCIPLINE', _('Inventory Discipline')
    OPERATIONAL_CONTROL = 'OPERATIONAL_CONTROL', _('Operational Control')
    ATTENDANCE = 'ATTENDANCE', _('Attendance')
    INITIATIVE = 'INITIATIVE', _('Initiative')
    PROBLEM_SOLVING = 'PROBLEM_SOLVING', _('Problem Solving')
    RISK_BEHAVIOR = 'RISK_BEHAVIOR', _('Risk Behavior')

class ScoreDirection(models.TextChoices):
    POSITIVE = 'POSITIVE', _('Positive')
    NEGATIVE = 'NEGATIVE', _('Negative')
    NEUTRAL = 'NEUTRAL', _('Neutral')

class PriorityLevel(models.TextChoices):
    LOW = 'LOW', _('Low')
    NORMAL = 'NORMAL', _('Normal')
    HIGH = 'HIGH', _('High')
    CRITICAL = 'CRITICAL', _('Critical')
    EMERGENCY = 'EMERGENCY', _('Emergency')

class SeverityLevel(models.TextChoices):
    MINOR = 'MINOR', _('Minor')
    MEDIUM = 'MEDIUM', _('Medium')
    MAJOR = 'MAJOR', _('Major')
    CRITICAL = 'CRITICAL', _('Critical')

class ConfidenceLevel(models.TextChoices):
    LOW = 'LOW', _('Low')
    MEDIUM = 'MEDIUM', _('Medium')
    HIGH = 'HIGH', _('High')
    VERIFIED = 'VERIFIED', _('Verified')

class BadgeLevel(models.TextChoices):
    PLATINUM = 'PLATINUM', _('Platinum')
    GOLD = 'GOLD', _('Gold')
    SILVER = 'SILVER', _('Silver')
    BRONZE = 'BRONZE', _('Bronze')
    WATCHLIST = 'WATCHLIST', _('Watchlist')

class RiskLevel(models.TextChoices):
    STABLE = 'STABLE', _('Stable')
    AT_RISK = 'AT_RISK', _('At Risk')
    HIGH_RISK = 'HIGH_RISK', _('High Risk')
    CRITICAL = 'CRITICAL', _('Critical')

# ═══════════════════════════════════════════════════════════════════
# 1. Score Rules
# ═══════════════════════════════════════════════════════════════════

class ScoreRule(TenantModel):
    """
    Dynamic rules engine for mapping system events to score points.
    """
    code = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    module = models.CharField(max_length=50, help_text="e.g. crm, sales, inventory")
    submodule = models.CharField(max_length=50, null=True, blank=True)
    event_type = models.CharField(max_length=100)
    event_code = models.CharField(max_length=100, help_text="Specific event code from the module")

    is_active = models.BooleanField(default=True)
    direction = models.CharField(max_length=20, choices=ScoreDirection.choices, default=ScoreDirection.POSITIVE)

    base_points = models.DecimalField(max_digits=10, decimal_places=2)
    dimension = models.CharField(max_length=50, choices=ScoreDimension.choices)
    score_family = models.CharField(max_length=50, choices=ScoreFamily.choices, default=ScoreFamily.PERFORMANCE)

    default_priority = models.CharField(max_length=20, choices=PriorityLevel.choices, default=PriorityLevel.NORMAL)
    default_severity = models.CharField(max_length=20, choices=SeverityLevel.choices, default=SeverityLevel.MEDIUM)
    default_confidence = models.CharField(max_length=20, choices=ConfidenceLevel.choices, default=ConfidenceLevel.HIGH)

    daily_cap = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    weekly_cap = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    monthly_cap = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cooldown_minutes = models.IntegerField(default=0)

    # Scoping (JSON filters)
    role_scope = models.JSONField(default=list, blank=True, help_text="List of role IDs this rule applies to")
    department_scope = models.JSONField(default=list, blank=True, help_text="List of department IDs")
    branch_scope = models.JSONField(default=list, blank=True, help_text="List of site IDs")

    condition_json = models.JSONField(default=dict, blank=True, help_text="Advanced logic conditions")
    formula_json = models.JSONField(default=dict, blank=True, help_text="Custom point calculation formula")

    requires_review = models.BooleanField(default=False)
    can_be_reversed = models.BooleanField(default=True)
    can_be_manual = models.BooleanField(default=False)
    is_critical_rule = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workforce_score_rule'
        unique_together = ('organization', 'code')

# ═══════════════════════════════════════════════════════════════════
# 2. Score Events
# ═══════════════════════════════════════════════════════════════════

class EmployeeScoreEvent(TenantModel):
    """
    Detailed ledger of every scoring event for an employee.
    """
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='score_events')
    branch = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey('hr.Department', on_delete=models.SET_NULL, null=True, blank=True)
    # user_role is usually on the User or Employee object. 
    # For snapshot purposes, we might want to store the role ID here.
    role_id = models.IntegerField(null=True, blank=True)

    module = models.CharField(max_length=50)
    submodule = models.CharField(max_length=50, null=True, blank=True)
    event_type = models.CharField(max_length=100)
    event_code = models.CharField(max_length=100)

    # Generic link to the source transaction
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    reference_object = GenericForeignKey('content_type', 'object_id')
    reference_number = models.CharField(max_length=100, null=True, blank=True)

    direction = models.CharField(max_length=20, choices=ScoreDirection.choices)
    base_points = models.DecimalField(max_digits=10, decimal_places=2)
    final_points = models.DecimalField(max_digits=10, decimal_places=2)

    priority_level = models.CharField(max_length=20, choices=PriorityLevel.choices)
    priority_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))

    severity_level = models.CharField(max_length=20, choices=SeverityLevel.choices)
    severity_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))

    confidence_level = models.CharField(max_length=20, choices=ConfidenceLevel.choices)
    confidence_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))

    module_weight = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))
    role_weight = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))
    recency_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))

    dimension = models.CharField(max_length=50, choices=ScoreDimension.choices)
    score_family = models.CharField(max_length=50, choices=ScoreFamily.choices)

    status = models.CharField(max_length=20, default='CONFIRMED', help_text="CONFIRMED, REVERSED, DISPUTED")
    is_manual = models.BooleanField(default=False)
    is_system_generated = models.BooleanField(default=True)
    requires_review = models.BooleanField(default=False)

    event_at = models.DateTimeField(default=timezone.now)
    effective_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_scores')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_scores')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    metadata_json = models.JSONField(default=dict, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'workforce_score_event'
        ordering = ['-event_at']

# ═══════════════════════════════════════════════════════════════════
# 3. Score Summaries & Trends
# ═══════════════════════════════════════════════════════════════════

class EmployeeScoreSummary(TenantModel):
    """
    Denormalized totals for fast dashboarding. 
    Updated by the PerformanceScoreEngine on every event.
    """
    employee = models.OneToOneField('hr.Employee', on_delete=models.CASCADE, related_name='score_summary')
    branch = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey('hr.Department', on_delete=models.SET_NULL, null=True, blank=True)
    role_id = models.IntegerField(null=True, blank=True)

    # Core scores (0-100 normalized usually)
    global_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    performance_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    trust_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    compliance_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    reliability_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    leadership_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    risk_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))

    # Dimension scores
    productivity_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    accuracy_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    timeliness_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    customer_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    attendance_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    financial_discipline_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    inventory_discipline_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    teamwork_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))

    total_positive_points = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_negative_points = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    net_points = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    event_count = models.IntegerField(default=0)
    critical_negative_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    reward_count = models.IntegerField(default=0)

    current_rank_company = models.IntegerField(null=True, blank=True)
    current_rank_branch = models.IntegerField(null=True, blank=True)
    current_rank_role = models.IntegerField(null=True, blank=True)

    badge_level = models.CharField(max_length=20, choices=BadgeLevel.choices, default=BadgeLevel.BRONZE)
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices, default=RiskLevel.STABLE)
    
    last_event_at = models.DateTimeField(null=True, blank=True)
    last_recalculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workforce_score_summary'

class EmployeeScorePeriod(TenantModel):
    """
    Historical snapshots (Weekly/Monthly) for trending.
    """
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE)
    period_type = models.CharField(max_length=20, default='MONTHLY') # DAILY, WEEKLY, MONTHLY
    period_key = models.CharField(max_length=20, help_text="e.g. 2026-03")

    global_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    performance_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    trust_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    compliance_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    reliability_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    leadership_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))

    rank_company = models.IntegerField(null=True, blank=True)
    rank_branch = models.IntegerField(null=True, blank=True)
    rank_role = models.IntegerField(null=True, blank=True)

    positive_points = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    negative_points = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    net_points = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    is_eligible_for_award = models.BooleanField(default=True)
    badge_awarded = models.CharField(max_length=20, choices=BadgeLevel.choices, null=True, blank=True)
    snapshot_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workforce_score_period'
        unique_together = ('organization', 'employee', 'period_type', 'period_key')

# ═══════════════════════════════════════════════════════════════════
# 4. Adjustments & Badges
# ═══════════════════════════════════════════════════════════════════

class EmployeeScoreAdjustment(TenantModel):
    """
    Manual adjustments by managers.
    """
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE)
    adjustment_type = models.CharField(max_length=20, default='BONUS') # BONUS, PENALTY, CORRECTION
    points = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    dimension = models.CharField(max_length=50, choices=ScoreDimension.choices)
    score_family = models.CharField(max_length=50, choices=ScoreFamily.choices, default=ScoreFamily.PERFORMANCE)

    priority_level = models.CharField(max_length=20, choices=PriorityLevel.choices, default=PriorityLevel.NORMAL)
    severity_level = models.CharField(max_length=20, choices=SeverityLevel.choices, default=SeverityLevel.MEDIUM)

    # Link to a reference if any
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='requested_adjustments')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustment_approvals')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workforce_score_adjustment'

class EmployeeBadge(TenantModel):
    """
    Historical record of badges earned.
    One badge per employee per period (unique on org + employee + period_key).
    """
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='badges')
    badge_code = models.CharField(max_length=50, choices=BadgeLevel.choices)
    badge_name = models.CharField(max_length=100)
    period_key = models.CharField(max_length=20, null=True, blank=True)
    awarded_at = models.DateTimeField(auto_now_add=True)
    awarded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'workforce_badge'
        unique_together = ('organization', 'employee', 'period_key')
