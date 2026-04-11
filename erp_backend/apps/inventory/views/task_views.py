"""
Views for ProductTask — task queue with claim/complete/cancel actions.
"""
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views_base import TenantModelViewSet
from apps.inventory.models.task_models import ProductTask
from apps.inventory.serializers.task_serializers import ProductTaskSerializer


class ProductTaskViewSet(TenantModelViewSet):
    """
    CRUD + workflow actions for product tasks.
    Filterable by status, priority, task_type, assigned_role, assigned_to, product.
    """
    queryset = ProductTask.objects.select_related(
        'product', 'assigned_to', 'completed_by'
    ).all()
    serializer_class = ProductTaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'priority', 'task_type', 'assigned_role', 'assigned_to', 'product']
    search_fields = ['title', 'product__name', 'product__sku']
    ordering_fields = ['created_at', 'due_date', 'priority']

    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        """Assign the task to the current user."""
        task = self.get_object()
        if task.status not in ('OPEN',):
            return Response({'error': f'Cannot claim: status is {task.status}'}, status=status.HTTP_400_BAD_REQUEST)

        task.assigned_to = request.user
        task.status = 'IN_PROGRESS'
        task.save(update_fields=['assigned_to', 'status', 'updated_at'])
        return Response(ProductTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark the task as done."""
        task = self.get_object()
        if task.status not in ('OPEN', 'IN_PROGRESS'):
            return Response({'error': f'Cannot complete: status is {task.status}'}, status=status.HTTP_400_BAD_REQUEST)

        task.status = 'DONE'
        task.completed_at = timezone.now()
        task.completed_by = request.user
        task.save(update_fields=['status', 'completed_at', 'completed_by', 'updated_at'])
        return Response(ProductTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the task."""
        task = self.get_object()
        if task.status == 'DONE':
            return Response({'error': 'Cannot cancel a done task'}, status=status.HTTP_400_BAD_REQUEST)

        task.status = 'CANCELLED'
        task.save(update_fields=['status', 'updated_at'])
        return Response(ProductTaskSerializer(task).data)

    @action(detail=False, methods=['get'], url_path='my-tasks')
    def my_tasks(self, request):
        """List tasks assigned to the current user (open + in progress)."""
        qs = self.get_queryset().filter(
            assigned_to=request.user,
            status__in=['OPEN', 'IN_PROGRESS']
        ).order_by('-priority', 'due_date')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='queue')
    def task_queue(self, request):
        """List unassigned open tasks, filterable by role."""
        role = request.query_params.get('role', '')
        qs = self.get_queryset().filter(
            assigned_to__isnull=True,
            status='OPEN'
        )
        if role:
            qs = qs.filter(assigned_role=role)
        qs = qs.order_by('-priority', 'created_at')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Task queue summary counts by status and type."""
        from django.db.models import Count
        qs = self.get_queryset()

        by_status = dict(qs.values_list('status').annotate(count=Count('id')).values_list('status', 'count'))
        by_type = dict(qs.filter(status__in=['OPEN', 'IN_PROGRESS']).values_list('task_type').annotate(count=Count('id')).values_list('task_type', 'count'))

        return Response({
            'total_open': by_status.get('OPEN', 0) + by_status.get('IN_PROGRESS', 0),
            'by_status': by_status,
            'by_type': by_type,
        })
