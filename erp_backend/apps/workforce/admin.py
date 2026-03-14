"""
WISE Engine — Django Admin
==============================
Provides read-only audit and configuration views for the
Workforce Intelligence & Scoring Engine (WISE).
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    ScoreRule, EmployeeScoreEvent, EmployeeScoreSummary,
    EmployeeBadge, EmployeeScorePeriod, EmployeeScoreAdjustment,
    RiskLevel
)


# ─────────────────────────────────────────────────────────────
# SCORE RULES
# ─────────────────────────────────────────────────────────────

@admin.register(ScoreRule)
class ScoreRuleAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'module', 'dimension', 'direction_badge', 'base_points', 'is_active']
    list_filter  = ['module', 'dimension', 'direction', 'score_family', 'is_active']
    search_fields = ['code', 'name', 'event_code']
    list_editable = ['is_active']
    ordering = ['module', 'dimension']

    def direction_badge(self, obj):
        color = '#22c55e' if obj.direction == 'POSITIVE' else '#ef4444' if obj.direction == 'NEGATIVE' else '#64748b'
        return format_html(
            '<span style="color:{};font-weight:700;">{}</span>', color, obj.direction
        )
    direction_badge.short_description = 'Direction'


# ─────────────────────────────────────────────────────────────
# SCORE EVENTS
# ─────────────────────────────────────────────────────────────

@admin.register(EmployeeScoreEvent)
class EmployeeScoreEventAdmin(admin.ModelAdmin):
    list_display = [
        'employee', 'event_code', 'module', 'dimension',
        'direction_badge', 'final_points', 'severity_level', 'status', 'event_at'
    ]
    list_filter  = ['module', 'dimension', 'direction', 'status', 'severity_level', 'is_manual']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'event_code', 'reference_number']
    readonly_fields = ['final_points', 'priority_multiplier', 'severity_multiplier', 'confidence_multiplier', 'event_at']
    ordering = ['-event_at']
    date_hierarchy = 'event_at'

    def direction_badge(self, obj):
        if obj.direction == 'POSITIVE':
            return format_html('<span style="color:#22c55e;font-weight:700;">▲ {}</span>', obj.final_points)
        elif obj.direction == 'NEGATIVE':
            return format_html('<span style="color:#ef4444;font-weight:700;">▼ -{}</span>', obj.final_points)
        return format_html('<span style="color:#64748b;">{}</span>', obj.final_points)
    direction_badge.short_description = 'Points'

    actions = ['mark_reversed']

    def mark_reversed(self, request, queryset):
        updated = queryset.update(status='REVERSED')
        self.message_user(request, f'{updated} events reversed.')

        # Recalculate summaries for affected employees
        from .services import WorkforceScoreEngine
        employee_ids = queryset.values_list('employee_id', flat=True).distinct()
        from erp.connector_registry import connector
        Employee = connector.require('hr.employees.get_model', org_id=0, source='workforce')
        if not Employee:
            return
        for emp in Employee.objects.filter(id__in=employee_ids):
            WorkforceScoreEngine.update_employee_summary(emp)
            WorkforceScoreEngine.rank_employees(emp.organization_id)

    mark_reversed.short_description = 'Reverse selected events (recomputes summary)'


# ─────────────────────────────────────────────────────────────
# SCORE SUMMARIES
# ─────────────────────────────────────────────────────────────

@admin.register(EmployeeScoreSummary)
class EmployeeScoreSummaryAdmin(admin.ModelAdmin):
    list_display = [
        'employee', 'global_score_badge', 'risk_level_badge', 'badge_level',
        'net_points', 'event_count', 'critical_negative_count',
        'current_rank_company', 'last_event_at'
    ]
    list_filter = ['risk_level', 'badge_level']
    search_fields = ['employee__user__first_name', 'employee__user__last_name']
    readonly_fields = [
        'global_score', 'performance_score', 'trust_score', 'compliance_score',
        'reliability_score', 'net_points', 'event_count', 'critical_negative_count',
        'risk_level', 'badge_level', 'current_rank_company', 'current_rank_branch',
        'last_event_at', 'last_recalculated_at'
    ]
    ordering = ['-global_score']

    def global_score_badge(self, obj):
        score = float(obj.global_score)
        if score >= 90:   color = '#8b5cf6'  # Platinum
        elif score >= 80: color = '#f59e0b'  # Gold
        elif score >= 70: color = '#94a3b8'  # Silver
        elif score >= 60: color = '#ea580c'  # Bronze
        else:             color = '#ef4444'  # Watchlist
        return format_html(
            '<span style="color:{};font-weight:900;font-size:1.1em;">{:.1f}</span>', color, score
        )
    global_score_badge.short_description = 'Global Score'
    global_score_badge.admin_order_field = 'global_score'

    def risk_level_badge(self, obj):
        colors = {
            RiskLevel.STABLE: '#22c55e',
            RiskLevel.AT_RISK: '#f59e0b',
            RiskLevel.HIGH_RISK: '#f97316',
            RiskLevel.CRITICAL: '#ef4444',
        }
        color = colors.get(obj.risk_level, '#64748b')
        return format_html(
            '<span style="color:{};font-weight:700;background:{}20;padding:2px 8px;border-radius:8px;">{}</span>',
            color, color, obj.risk_level
        )
    risk_level_badge.short_description = 'Risk'

    actions = ['recompute_summaries']

    def recompute_summaries(self, request, queryset):
        from .services import WorkforceScoreEngine
        for s in queryset.select_related('employee'):
            WorkforceScoreEngine.update_employee_summary(s.employee)
        self.message_user(request, f'{queryset.count()} summaries recomputed.')
    recompute_summaries.short_description = 'Force recalculate selected summaries'


# ─────────────────────────────────────────────────────────────
# BADGES
# ─────────────────────────────────────────────────────────────

@admin.register(EmployeeBadge)
class EmployeeBadgeAdmin(admin.ModelAdmin):
    list_display = ['employee', 'badge_code', 'badge_name', 'period_key', 'awarded_at']
    list_filter = ['badge_code', 'period_key']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'badge_name']
    ordering = ['-awarded_at']


# ─────────────────────────────────────────────────────────────
# SCORE ADJUSTMENTS
# ─────────────────────────────────────────────────────────────

@admin.register(EmployeeScoreAdjustment)
class EmployeeScoreAdjustmentAdmin(admin.ModelAdmin):
    list_display = ['employee', 'adjustment_type', 'points', 'dimension', 'reason', 'requested_by', 'created_at']
    list_filter = ['adjustment_type', 'dimension']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'reason']
    ordering = ['-created_at']


# ─────────────────────────────────────────────────────────────
# SCORE PERIODS
# ─────────────────────────────────────────────────────────────

@admin.register(EmployeeScorePeriod)
class EmployeeScorePeriodAdmin(admin.ModelAdmin):
    list_display = ['employee', 'period_type', 'period_key', 'global_score', 'rank_company', 'badge_awarded', 'snapshot_at']
    list_filter = ['period_type', 'period_key']
    search_fields = ['employee__user__first_name', 'employee__user__last_name']
    ordering = ['-snapshot_at']
