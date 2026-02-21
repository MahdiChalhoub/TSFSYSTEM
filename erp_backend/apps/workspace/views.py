"""
Workspace Module — ViewSets
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q, Count

from erp.mixins import TenantFilterMixin, AuditLogMixin
from .models import (
    TaskCategory, TaskTemplate, AutoTaskRule, Task, TaskComment,
    TaskAttachment, EmployeeRequest,
    ChecklistTemplate, ChecklistTemplateItem, ChecklistInstance, ChecklistItemResponse,
    Questionnaire, QuestionnaireQuestion, QuestionnaireResponse, QuestionnaireAnswer,
    WorkspaceConfig, EmployeePerformance,
)
from .serializers import (
    TaskCategorySerializer, TaskTemplateSerializer, AutoTaskRuleSerializer,
    TaskSerializer, TaskListSerializer, TaskCommentSerializer, TaskAttachmentSerializer,
    EmployeeRequestSerializer,
    ChecklistTemplateSerializer, ChecklistTemplateItemSerializer,
    ChecklistInstanceSerializer, ChecklistItemResponseSerializer,
    QuestionnaireSerializer, QuestionnaireQuestionSerializer,
    QuestionnaireResponseSerializer, QuestionnaireAnswerSerializer,
    WorkspaceConfigSerializer, EmployeePerformanceSerializer,
)

logger = logging.getLogger(__name__)


# =============================================================================
# TASK MANAGEMENT
# =============================================================================

class TaskCategoryViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = TaskCategory.objects.all()
    serializer_class = TaskCategorySerializer
    permission_classes = [IsAuthenticated]


class TaskTemplateViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = TaskTemplate.objects.select_related('category').all()
    serializer_class = TaskTemplateSerializer
    permission_classes = [IsAuthenticated]


class AutoTaskRuleViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = AutoTaskRule.objects.select_related('template').all()
    serializer_class = AutoTaskRuleSerializer
    permission_classes = [IsAuthenticated]


class TaskViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = Task.objects.select_related('category', 'assigned_by', 'assigned_to', 'template').all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return TaskListSerializer
        return TaskSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        # Filter by assigned_to (my tasks)
        mine = self.request.query_params.get('mine')
        if mine == 'true':
            qs = qs.filter(assigned_to=self.request.user)
        # Filter by assigned_by
        assigned_by = self.request.query_params.get('assigned_by')
        if assigned_by == 'me':
            qs = qs.filter(assigned_by=self.request.user)
        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            qs = qs.filter(priority=priority)
        # Root tasks only (exclude subtasks)
        root_only = self.request.query_params.get('root_only')
        if root_only == 'true':
            qs = qs.filter(parent_task__isnull=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            assigned_by=self.request.user,
        )

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        task = self.get_object()
        task.start()
        return Response({'status': 'started'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.complete()
        return Response({'status': 'completed'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        task = self.get_object()
        task.cancel()
        return Response({'status': 'cancelled'})

    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        task = self.get_object()
        content = request.data.get('content', '')
        is_response = request.data.get('is_response', False)
        if not content.strip():
            return Response({'error': 'Content is required'}, status=status.HTTP_400_BAD_REQUEST)
        comment = TaskComment.objects.create(
            organization=request.user.organization,
            task=task,
            author=request.user,
            content=content,
            is_response=is_response,
        )
        return Response(TaskCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Task dashboard KPIs for the current user."""
        qs = self.get_queryset()
        my_tasks = qs.filter(assigned_to=request.user)
        return Response({
            'total_assigned': my_tasks.count(),
            'pending': my_tasks.filter(status='PENDING').count(),
            'in_progress': my_tasks.filter(status='IN_PROGRESS').count(),
            'completed': my_tasks.filter(status='COMPLETED').count(),
            'overdue': my_tasks.filter(
                due_date__lt=timezone.now(),
                status__in=['PENDING', 'IN_PROGRESS']
            ).count(),
            'assigned_by_me': qs.filter(assigned_by=request.user).count(),
        })


class TaskCommentViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = TaskComment.objects.select_related('author').all()
    serializer_class = TaskCommentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            author=self.request.user,
        )


class EmployeeRequestViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = EmployeeRequest.objects.select_related('requested_by', 'reviewed_by').all()
    serializer_class = EmployeeRequestSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            requested_by=self.request.user,
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        obj = self.get_object()
        obj.approve(request.user)
        # Optionally create a task from the request
        if request.data.get('create_task', False):
            task = Task.objects.create(
                organization=request.user.organization,
                title=obj.title,
                description=obj.description,
                assigned_by=request.user,
                source='REQUEST',
            )
            obj.resulting_task = task
            obj.save(update_fields=['resulting_task'])
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        obj = self.get_object()
        obj.reject(request.user)
        return Response({'status': 'rejected'})


# =============================================================================
# CHECKLISTS
# =============================================================================

class ChecklistTemplateViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = ChecklistTemplate.objects.prefetch_related('items').all()
    serializer_class = ChecklistTemplateSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        template = self.get_object()
        item = ChecklistTemplateItem.objects.create(
            organization=request.user.organization,
            template=template,
            label=request.data.get('label', ''),
            description=request.data.get('description', ''),
            order=request.data.get('order', 0),
            is_required=request.data.get('is_required', True),
        )
        return Response(ChecklistTemplateItemSerializer(item).data, status=status.HTTP_201_CREATED)


class ChecklistTemplateItemViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = ChecklistTemplateItem.objects.all()
    serializer_class = ChecklistTemplateItemSerializer
    permission_classes = [IsAuthenticated]


class ChecklistInstanceViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = ChecklistInstance.objects.select_related('template', 'assigned_to').prefetch_related('item_responses').all()
    serializer_class = ChecklistInstanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        mine = self.request.query_params.get('mine')
        if mine == 'true':
            qs = qs.filter(assigned_to=self.request.user)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(organization=self.request.user.organization)
        # Auto-create item responses from template
        for item in instance.template.items.all():
            ChecklistItemResponse.objects.create(
                organization=self.request.user.organization,
                instance=instance,
                template_item=item,
            )

    @action(detail=True, methods=['post'])
    def check_item(self, request, pk=None):
        """Toggle a checklist item's checked status."""
        instance = self.get_object()
        item_id = request.data.get('item_id')
        is_checked = request.data.get('is_checked', True)
        try:
            response = instance.item_responses.get(template_item_id=item_id)
            response.is_checked = is_checked
            response.checked_at = timezone.now() if is_checked else None
            response.notes = request.data.get('notes', response.notes)
            response.save(update_fields=['is_checked', 'checked_at', 'notes'])
            # Check if all required items are complete
            instance.check_completion()
            return Response(ChecklistItemResponseSerializer(response).data)
        except ChecklistItemResponse.DoesNotExist:
            return Response({'error': 'Item not found'}, status=status.HTTP_404_NOT_FOUND)


# =============================================================================
# QUESTIONNAIRES
# =============================================================================

class QuestionnaireViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = Questionnaire.objects.prefetch_related('questions').all()
    serializer_class = QuestionnaireSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def add_question(self, request, pk=None):
        questionnaire = self.get_object()
        q = QuestionnaireQuestion.objects.create(
            organization=request.user.organization,
            questionnaire=questionnaire,
            question_text=request.data.get('question_text', ''),
            question_type=request.data.get('question_type', 'RATING'),
            choices=request.data.get('choices', []),
            max_score=request.data.get('max_score', 5),
            order=request.data.get('order', 0),
        )
        return Response(QuestionnaireQuestionSerializer(q).data, status=status.HTTP_201_CREATED)


class QuestionnaireQuestionViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = QuestionnaireQuestion.objects.all()
    serializer_class = QuestionnaireQuestionSerializer
    permission_classes = [IsAuthenticated]


class QuestionnaireResponseViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = QuestionnaireResponse.objects.select_related('questionnaire', 'employee', 'evaluator').prefetch_related('answers').all()
    serializer_class = QuestionnaireResponseSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            evaluator=self.request.user,
        )

    @action(detail=True, methods=['post'])
    def submit_answers(self, request, pk=None):
        """Submit all answers for a questionnaire response."""
        response_obj = self.get_object()
        answers_data = request.data.get('answers', [])
        for answer in answers_data:
            QuestionnaireAnswer.objects.update_or_create(
                organization=request.user.organization,
                response=response_obj,
                question_id=answer['question_id'],
                defaults={
                    'score': answer.get('score', 0),
                    'text_answer': answer.get('text_answer'),
                    'choice_answer': answer.get('choice_answer'),
                }
            )
        response_obj.calculate_score()
        return Response(QuestionnaireResponseSerializer(response_obj).data)


# =============================================================================
# KPI & SCORING
# =============================================================================

class WorkspaceConfigViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = WorkspaceConfig.objects.all()
    serializer_class = WorkspaceConfigSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def current(self, request):
        config = WorkspaceConfig.get_config(request.user.organization)
        return Response(WorkspaceConfigSerializer(config).data)


class EmployeePerformanceViewSet(TenantFilterMixin, AuditLogMixin, viewsets.ReadOnlyModelViewSet):
    queryset = EmployeePerformance.objects.select_related('employee').all()
    serializer_class = EmployeePerformanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        period = self.request.query_params.get('period')
        if period:
            qs = qs.filter(period_label=period)
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """Top performers for the given period."""
        period = request.query_params.get('period')
        qs = self.get_queryset()
        if period:
            qs = qs.filter(period_label=period)
        top = qs.order_by('-overall_score')[:20]
        return Response(EmployeePerformanceSerializer(top, many=True).data)

    @action(detail=False, methods=['get'])
    def my_performance(self, request):
        """Current user's performance history."""
        qs = self.get_queryset().filter(employee=request.user).order_by('-period_label')[:12]
        return Response(EmployeePerformanceSerializer(qs, many=True).data)
