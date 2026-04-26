"""
Audit Trail API — Generic ViewSet
===================================
Read-only ViewSet that exposes AuditLog entries filtered by resource_type.
Supports verify/confirm/undo annotations and task creation from audit entries.

Any module can register this at their own URL prefix to expose audit trails
for their resources without writing custom views.

Usage in urls.py:
    from kernel.audit.views import AuditTrailViewSet
    router.register(r'category-audit', AuditTrailViewSet, basename='category-audit')
    # Then filter by ?resource_type=category
"""

from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from kernel.audit.models import AuditLog, AuditTrail
from kernel.tenancy.middleware import get_current_tenant


class AuditTrailFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditTrail
        fields = ['field_name', 'old_value', 'new_value', 'field_type']


class AuditLogSerializer(serializers.ModelSerializer):
    field_changes = AuditTrailFieldSerializer(many=True, read_only=True)
    verified_by = serializers.SerializerMethodField()
    verified_at = serializers.SerializerMethodField()
    confirmed_by = serializers.SerializerMethodField()
    confirmed_at = serializers.SerializerMethodField()
    undo_requested = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'resource_type', 'resource_id', 'resource_repr',
            'username', 'timestamp', 'severity', 'success',
            'details', 'field_changes',
            'verified_by', 'verified_at',
            'confirmed_by', 'confirmed_at',
            'undo_requested',
        ]

    def get_verified_by(self, obj):
        return obj.details.get('verified_by')

    def get_verified_at(self, obj):
        return obj.details.get('verified_at')

    def get_confirmed_by(self, obj):
        return obj.details.get('confirmed_by')

    def get_confirmed_at(self, obj):
        return obj.details.get('confirmed_at')

    def get_undo_requested(self, obj):
        return bool(obj.details.get('undo_requested_by'))


class AuditTrailViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Generic read-only audit trail endpoint.

    Filter by ?resource_type=category (or brand, parfum, etc.)
    Sorted by -timestamp.  Returns last 200 entries.
    """
    queryset = AuditLog.objects.none()  # Required by DRF router — overridden by get_queryset()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # No pagination — we limit in queryset

    def get_queryset(self):
        org = get_current_tenant()
        if not org:
            return AuditLog.objects.none()
        qs = AuditLog.objects.filter(organization=org).select_related('user')
        qs = qs.prefetch_related('field_changes')

        resource_type = self.request.query_params.get('resource_type')
        if resource_type:
            qs = qs.filter(resource_type=resource_type)

        return qs.order_by('-timestamp')[:200]

    def get_object(self):
        """Override to avoid filtering on sliced queryset for detail actions."""
        org = get_current_tenant()
        if not org:
            from rest_framework.exceptions import NotFound
            raise NotFound('No organization context')
        pk = self.kwargs.get('pk')
        try:
            obj = AuditLog.objects.filter(organization=org).select_related('user').prefetch_related('field_changes').get(pk=pk)
        except AuditLog.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Audit entry not found')
        return obj

    # ── Annotate: Verify ──
    @action(detail=True, methods=['post'], url_path='verify')
    def verify(self, request, pk=None):
        log = self.get_object()
        details = log.details or {}
        if details.get('verified_by'):
            return Response({'detail': 'Already verified'}, status=status.HTTP_400_BAD_REQUEST)
        details['verified_by'] = request.user.username
        details['verified_at'] = timezone.now().isoformat()
        log.details = details
        log.save(update_fields=['details'])
        return Response(self.get_serializer(log).data)

    # ── Annotate: Confirm ──
    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        log = self.get_object()
        details = log.details or {}
        if details.get('confirmed_by'):
            return Response({'detail': 'Already confirmed'}, status=status.HTTP_400_BAD_REQUEST)
        details['confirmed_by'] = request.user.username
        details['confirmed_at'] = timezone.now().isoformat()
        log.details = details
        log.save(update_fields=['details'])
        return Response(self.get_serializer(log).data)

    # ── Annotate: Undo/Cancel (flag only) ──
    @action(detail=True, methods=['post'], url_path='undo')
    def undo(self, request, pk=None):
        log = self.get_object()
        details = log.details or {}
        details['undo_requested_by'] = request.user.username
        details['undo_requested_at'] = timezone.now().isoformat()
        details['undo_reason'] = request.data.get('reason', '')
        log.details = details
        log.severity = 'WARNING'
        log.save(update_fields=['details', 'severity'])
        return Response(self.get_serializer(log).data)

    # ── Create Task from audit entry ──
    @action(detail=True, methods=['post'], url_path='create-task')
    def create_task(self, request, pk=None):
        log = self.get_object()
        org = get_current_tenant()

        # Import Task model via gated import (workspace module is optional)
        try:
            from apps.workspace.models import Task
            HAS_WORKSPACE = True
        except ImportError:
            HAS_WORKSPACE = False

        if not HAS_WORKSPACE:
            return Response(
                {'detail': 'Workspace module not installed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Build default title/description from audit entry
        action_display = log.action.replace('.', ' ').title()
        default_title = f"Review: {action_display} on {log.resource_repr}"
        default_description = (
            f"Audit entry #{log.id}\n"
            f"Action: {log.action}\n"
            f"Resource: {log.resource_repr} (ID: {log.resource_id})\n"
            f"By: {log.username}\n"
            f"Time: {log.timestamp.strftime('%Y-%m-%d %H:%M')}\n"
        )
        # Add field changes
        changes = log.field_changes.all()
        if changes:
            default_description += "\nField changes:\n"
            for c in changes:
                default_description += f"  • {c.field_name}: {c.old_value} → {c.new_value}\n"

        task = Task.objects.create(
            organization=org,
            title=request.data.get('title', default_title),
            description=request.data.get('description', default_description),
            created_by=request.user,
            assigned_to_id=request.data.get('assigned_to'),
            category_id=request.data.get('category'),
            priority=request.data.get('priority', 'medium'),
            status='todo',
        )

        # Link back: store task ID in audit details
        details = log.details or {}
        tasks_created = details.get('tasks_created', [])
        tasks_created.append(task.id)
        details['tasks_created'] = tasks_created
        log.details = details
        log.save(update_fields=['details'])

        return Response({
            'task_id': task.id,
            'title': task.title,
            'detail': 'Task created successfully',
        }, status=status.HTTP_201_CREATED)
