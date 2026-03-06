"""
Kernel Lifecycle ViewSet Mixin
==============================
Drop-in mixin that adds lifecycle action endpoints to any DRF ViewSet
whose model inherits PostableMixin.

Endpoints added:
    POST /{id}/submit/
    POST /{id}/verify/      ?level=N
    POST /{id}/approve/     ?level=N
    POST /{id}/reject/
    POST /{id}/post/
    POST /{id}/lock/
    POST /{id}/reverse/
    POST /{id}/cancel/
    POST /{id}/reopen/
    GET  /{id}/approvals/
    GET  /{id}/available_actions/
"""
from rest_framework import decorators, status
from rest_framework.response import Response
from django.core.exceptions import ValidationError, PermissionDenied
from .service import LifecycleService
from .models import TxnApproval


class LifecycleViewSetMixin:
    """
    Mixin for any DRF ViewSet whose model inherits PostableMixin.
    All lifecycle operations delegate to the kernel LifecycleService.
    """

    def _lifecycle_response(self, instance):
        """Standard response: serialized instance + approval timeline."""
        from django.utils.encoding import force_str
        import uuid
        import datetime

        def _json_safe(data):
            if isinstance(data, dict):
                return {k: _json_safe(v) for k, v in data.items()}
            elif isinstance(data, list):
                return [_json_safe(i) for i in data]
            elif isinstance(data, uuid.UUID):
                return str(data)
            elif isinstance(data, (datetime.datetime, datetime.date)):
                return data.isoformat()
            return data

        serializer = self.get_serializer(instance)
        txn_type = LifecycleService.get_txn_type(instance)
        approvals = TxnApproval.objects.filter(
            txn_type=txn_type,
            txn_id=instance.id
        ).select_related('actor').order_by('created_at')

        timeline = [{
            'level': a.level,
            'action': a.action,
            'actor_name': a.actor.get_full_name() or a.actor.username,
            'note': a.note,
            'created_at': a.created_at,
        } for a in approvals]

        return Response(_json_safe({
            'instance': serializer.data,
            'approvals': timeline,
            'available_actions': LifecycleService.get_available_actions(instance),
        }))

    def _handle_lifecycle_error(self, e):
        """Map exception types to HTTP status codes."""
        from django.utils.encoding import force_str
        if isinstance(e, PermissionDenied):
            return Response({'error': force_str(e)}, status=status.HTTP_403_FORBIDDEN)
        return Response({'error': force_str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ── Actions ──────────────────────────────────────────────────────────

    @decorators.action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        instance = self.get_object()
        try:
            LifecycleService.submit(instance, request.user, note=request.data.get('note'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    @decorators.action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        instance = self.get_object()
        level = int(request.data.get('level') or request.query_params.get('level', 1))
        try:
            LifecycleService.verify(instance, request.user, level=level, note=request.data.get('note'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    @decorators.action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        instance = self.get_object()
        level = request.data.get('level') or request.query_params.get('level')
        if level:
            level = int(level)
        try:
            LifecycleService.approve(instance, request.user, level=level, note=request.data.get('note'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    @decorators.action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        instance = self.get_object()
        try:
            LifecycleService.reject(instance, request.user, note=request.data.get('note'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    @decorators.action(detail=True, methods=['post'], url_path='post_txn')
    def post_txn(self, request, pk=None):
        instance = self.get_object()
        try:
            LifecycleService.post(instance, request.user, note=request.data.get('note'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    @decorators.action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        instance = self.get_object()
        try:
            LifecycleService.lock(instance, request.user, note=request.data.get('note'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    @decorators.action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        instance = self.get_object()
        try:
            LifecycleService.reverse(instance, request.user, reason=request.data.get('reason'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    @decorators.action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        instance = self.get_object()
        try:
            LifecycleService.cancel(instance, request.user, reason=request.data.get('reason'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    @decorators.action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        instance = self.get_object()
        try:
            LifecycleService.reopen(instance, request.user, note=request.data.get('note'))
            return self._lifecycle_response(instance)
        except (ValidationError, PermissionDenied) as e:
            return self._handle_lifecycle_error(e)

    # ── Read-only endpoints ──────────────────────────────────────────────

    @decorators.action(detail=True, methods=['get'])
    def approvals(self, request, pk=None):
        instance = self.get_object()
        txn_type = LifecycleService.get_txn_type(instance)
        approvals = TxnApproval.objects.filter(
            txn_type=txn_type,
            txn_id=instance.id
        ).select_related('actor').order_by('created_at')

        data = [{
            'level': a.level,
            'action': a.action,
            'actor_name': a.actor.get_full_name() or a.actor.username,
            'note': a.note,
            'created_at': a.created_at,
        } for a in approvals]
        return Response(data)

    @decorators.action(detail=True, methods=['get'])
    def available_actions(self, request, pk=None):
        instance = self.get_object()
        actions = LifecycleService.get_available_actions(instance)
        return Response({'actions': actions, 'current_status': instance.status})
