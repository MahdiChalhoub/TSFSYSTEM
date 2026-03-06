"""
Workspace Module — Django Admin
"""
from django.contrib import admin
from .models import (
    WorkspaceConfig, TaskCategory, TaskTemplate, AutoTaskRule, Task, TaskComment,
    TaskAttachment, EmployeeRequest,
    ChecklistTemplate, ChecklistTemplateItem, ChecklistInstance, ChecklistItemResponse,
    Questionnaire, QuestionnaireQuestion, QuestionnaireResponse, QuestionnaireAnswer,
    EmployeePerformance,
)


class TaskCommentInline(admin.TabularInline):
    model = TaskComment
    extra = 0


class ChecklistTemplateItemInline(admin.TabularInline):
    model = ChecklistTemplateItem
    extra = 1


class QuestionnaireQuestionInline(admin.TabularInline):
    model = QuestionnaireQuestion
    extra = 1


@admin.register(TaskCategory)
class TaskCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'color', 'is_active', )
    list_filter = ('is_active',)


@admin.register(TaskTemplate)
class TaskTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'default_priority', 'default_points', 'is_recurring', 'is_active')
    list_filter = ('is_active', 'is_recurring', 'default_priority')


@admin.register(AutoTaskRule)
class AutoTaskRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger_event', 'template', 'is_active')
    list_filter = ('is_active', 'trigger_event')


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'priority', 'assigned_to', 'due_date', 'source')
    list_filter = ('status', 'priority', 'source')
    search_fields = ('title',)
    inlines = [TaskCommentInline]


@admin.register(EmployeeRequest)
class EmployeeRequestAdmin(admin.ModelAdmin):
    list_display = ('title', 'request_type', 'status', 'requested_by', 'created_at')
    list_filter = ('status', 'request_type')


@admin.register(ChecklistTemplate)
class ChecklistTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger', 'points', 'is_active')
    list_filter = ('is_active', 'trigger')
    inlines = [ChecklistTemplateItemInline]


@admin.register(ChecklistInstance)
class ChecklistInstanceAdmin(admin.ModelAdmin):
    list_display = ('template', 'assigned_to', 'date', 'status', 'points_earned')
    list_filter = ('status',)


@admin.register(Questionnaire)
class QuestionnaireAdmin(admin.ModelAdmin):
    list_display = ('name', 'frequency', 'is_active')
    list_filter = ('is_active', 'frequency')
    inlines = [QuestionnaireQuestionInline]


@admin.register(QuestionnaireResponse)
class QuestionnaireResponseAdmin(admin.ModelAdmin):
    list_display = ('questionnaire', 'employee', 'evaluator', 'score_percentage', 'submitted_at')


@admin.register(WorkspaceConfig)
class WorkspaceConfigAdmin(admin.ModelAdmin):
    list_display = ('task_completion_weight', 'on_time_weight', 'checklist_weight', 'evaluation_weight')


@admin.register(EmployeePerformance)
class EmployeePerformanceAdmin(admin.ModelAdmin):
    list_display = ('employee', 'period_label', 'overall_score', 'tier')
    list_filter = ('tier',)
