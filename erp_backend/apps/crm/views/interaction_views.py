from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q
from erp.views import TenantModelViewSet
from apps.crm.models import (
    RelationshipAssignment, FollowUpPolicy, ScheduledActivity, 
    ActivityReminder, InteractionLog, SupplierProductPolicy
)
from apps.crm.serializers import (
    RelationshipAssignmentSerializer, FollowUpPolicySerializer,
    ScheduledActivitySerializer, ActivityReminderSerializer,
    InteractionLogSerializer, SupplierProductPolicySerializer
)
from apps.crm.services.followup_service import FollowUpService, ActivitySchedulerService

class RelationshipAssignmentViewSet(TenantModelViewSet):
    queryset = RelationshipAssignment.objects.all()
    serializer_class = RelationshipAssignmentSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        contact_id = self.request.query_params.get('contact')
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        return qs

class FollowUpPolicyViewSet(TenantModelViewSet):
    queryset = FollowUpPolicy.objects.all()
    serializer_class = FollowUpPolicySerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        contact_id = self.request.query_params.get('contact')
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        return qs

    @action(detail=True, methods=['post'])
    def trigger_task(self, request, pk=None):
        """Manually trigger task generation from this policy."""
        policy = self.get_object()
        task = ActivitySchedulerService.generate_task_from_policy(policy)
        if task:
            return Response(ScheduledActivitySerializer(task).data)
        return Response({"detail": "Task not created (policy inactive or duplicate exists)"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def run_scan(self, request):
        """Global scan for all active policies."""
        count = ActivitySchedulerService.scan_and_generate_all()
        return Response({"detail": f"Scan completed. {count} tasks generated."})

class ScheduledActivityViewSet(TenantModelViewSet):
    queryset = ScheduledActivity.objects.all()
    serializer_class = ScheduledActivitySerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        contact_id = self.request.query_params.get('contact')
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
            
        # Dashboard filters
        mode = self.request.query_params.get('mode')
        if mode == 'my_tasks':
            qs = qs.filter(assigned_to=self.request.user)
        elif mode == 'overdue':
            qs = qs.filter(due_date__lt=timezone.now(), status__in=['PLANNED', 'DUE'])
        elif mode == 'today':
            qs = qs.filter(due_date__date=timezone.now().date())
            
        return qs

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete the activity."""
        activity = self.get_object()
        outcome = request.data.get('outcome', 'SUCCESS')
        notes = request.data.get('notes', '')
        
        FollowUpService.complete_activity(activity, request.user, outcome, notes)
        return Response({"status": "Activity completed"})

    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        """Reschedule the activity."""
        activity = self.get_object()
        new_date = request.data.get('new_date')
        reason = request.data.get('reason', '')
        
        if not new_date:
            return Response({"error": "new_date is required"}, status=400)
            
        activity.due_date = new_date
        activity.status = 'RESCHEDULED'
        activity.postponed_count += 1
        activity.reschedule_reason = reason
        activity.save()
        
        # Regenerate reminders
        activity.reminders.filter(status='PENDING').update(status='CANCELLED')
        ActivitySchedulerService.create_reminders_for_task(activity)
        
        return Response(ScheduledActivitySerializer(activity).data)

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Aggregated stats for the activity dashboard."""
        qs = self.get_queryset().filter(assigned_to=request.user)
        now = timezone.now()
        
        stats = {
            "due_today": qs.filter(due_date__date=now.date(), status__in=['PLANNED', 'DUE']).count(),
            "overdue": qs.filter(due_date__lt=now, status__in=['PLANNED', 'DUE']).count(),
            "upcoming": qs.filter(due_date__gt=now, status='PLANNED').count(),
            "completed_today": qs.filter(completed_at__date=now.date(), status='DONE').count(),
        }
        return Response(stats)

class InteractionLogViewSet(TenantModelViewSet):
    queryset = InteractionLog.objects.all()
    serializer_class = InteractionLogSerializer
    http_method_names = ['get', 'post', 'head', 'options']
    
    def get_queryset(self):
        qs = super().get_queryset()
        contact_id = self.request.query_params.get('contact')
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        return qs

class SupplierProductPolicyViewSet(TenantModelViewSet):
    queryset = SupplierProductPolicy.objects.all()
    serializer_class = SupplierProductPolicySerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        supplier_id = self.request.query_params.get('supplier')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return qs
