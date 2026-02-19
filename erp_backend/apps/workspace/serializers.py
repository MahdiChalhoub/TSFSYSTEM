"""
Workspace Module — Serializers
"""
from rest_framework import serializers
from .models import (
    TaskCategory, TaskTemplate, AutoTaskRule, Task, TaskComment,
    TaskAttachment, EmployeeRequest,
    ChecklistTemplate, ChecklistTemplateItem, ChecklistInstance, ChecklistItemResponse,
    Questionnaire, QuestionnaireQuestion, QuestionnaireResponse, QuestionnaireAnswer,
    KPIConfig, EmployeeScore,
)


# =============================================================================
# TASK MANAGEMENT
# =============================================================================

class TaskCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCategory
        fields = '__all__'
        read_only_fields = ('organization',)


class TaskTemplateSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)

    class Meta:
        model = TaskTemplate
        fields = '__all__'
        read_only_fields = ('organization',)


class AutoTaskRuleSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    trigger_display = serializers.CharField(source='get_trigger_event_display', read_only=True)

    class Meta:
        model = AutoTaskRule
        fields = '__all__'
        read_only_fields = ('organization',)


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskComment
        fields = '__all__'
        read_only_fields = ('organization', 'author')

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.email or obj.author.username
        return 'System'


class TaskAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskAttachment
        fields = '__all__'
        read_only_fields = ('organization', 'uploaded_by')


class TaskSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    assigned_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    subtask_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    comments = TaskCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ('organization', 'assigned_by', 'completed_at')

    def get_assigned_by_name(self, obj):
        if obj.assigned_by:
            return obj.assigned_by.email or obj.assigned_by.username
        return None

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.email or obj.assigned_to.username
        return None

    def get_subtask_count(self, obj):
        return obj.subtasks.count()

    def get_comment_count(self, obj):
        return obj.comments.count()


class TaskListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for task lists (no nested comments)."""
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    assigned_to_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    subtask_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'status', 'priority', 'source', 'category', 'category_name',
            'assigned_to', 'assigned_to_name', 'points', 'due_date', 'is_overdue',
            'subtask_count', 'related_object_label', 'created_at',
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.email or obj.assigned_to.username
        return None

    def get_subtask_count(self, obj):
        return obj.subtasks.count()


class EmployeeRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    type_display = serializers.CharField(source='get_request_type_display', read_only=True)

    class Meta:
        model = EmployeeRequest
        fields = '__all__'
        read_only_fields = ('organization', 'requested_by', 'reviewed_by', 'reviewed_at', 'resulting_task')

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.email or obj.requested_by.username
        return None


# =============================================================================
# CHECKLISTS
# =============================================================================

class ChecklistTemplateItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistTemplateItem
        fields = '__all__'
        read_only_fields = ('organization',)


class ChecklistTemplateSerializer(serializers.ModelSerializer):
    items = ChecklistTemplateItemSerializer(many=True, read_only=True)
    trigger_display = serializers.CharField(source='get_trigger_display', read_only=True)

    class Meta:
        model = ChecklistTemplate
        fields = '__all__'
        read_only_fields = ('organization',)


class ChecklistItemResponseSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source='template_item.label', read_only=True)
    is_required = serializers.BooleanField(source='template_item.is_required', read_only=True)

    class Meta:
        model = ChecklistItemResponse
        fields = '__all__'
        read_only_fields = ('organization', 'instance', 'template_item')


class ChecklistInstanceSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    item_responses = ChecklistItemResponseSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = ChecklistInstance
        fields = '__all__'
        read_only_fields = ('organization', 'completed_at', 'points_earned')

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.email or obj.assigned_to.username
        return None

    def get_progress(self, obj):
        total = obj.item_responses.count()
        done = obj.item_responses.filter(is_checked=True).count()
        return {'total': total, 'done': done, 'percentage': round(done / total * 100) if total else 0}


# =============================================================================
# QUESTIONNAIRES
# =============================================================================

class QuestionnaireQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionnaireQuestion
        fields = '__all__'
        read_only_fields = ('organization',)


class QuestionnaireSerializer(serializers.ModelSerializer):
    questions = QuestionnaireQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Questionnaire
        fields = '__all__'
        read_only_fields = ('organization',)


class QuestionnaireAnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)

    class Meta:
        model = QuestionnaireAnswer
        fields = '__all__'
        read_only_fields = ('organization',)


class QuestionnaireResponseSerializer(serializers.ModelSerializer):
    questionnaire_name = serializers.CharField(source='questionnaire.name', read_only=True)
    employee_name = serializers.SerializerMethodField()
    answers = QuestionnaireAnswerSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionnaireResponse
        fields = '__all__'
        read_only_fields = ('organization', 'evaluator', 'total_score', 'max_possible_score', 'score_percentage')

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.email or obj.employee.username
        return None


# =============================================================================
# KPI & SCORING
# =============================================================================

class KPIConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = KPIConfig
        fields = '__all__'
        read_only_fields = ('organization',)


class EmployeeScoreSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()
    on_time_rate = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeScore
        fields = '__all__'
        read_only_fields = ('organization',)

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.email or obj.employee.username
        return None

    def get_completion_rate(self, obj):
        if obj.tasks_assigned:
            return round(obj.tasks_completed / obj.tasks_assigned * 100, 1)
        return 0

    def get_on_time_rate(self, obj):
        if obj.tasks_completed:
            return round(obj.tasks_on_time / obj.tasks_completed * 100, 1)
        return 0
