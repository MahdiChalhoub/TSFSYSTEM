"""
Transaction Lifecycle ViewSet Mixin
Adds lock / unlock / verify / unverify actions to any ViewSet.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from erp.lifecycle_service import TransactionLifecycleService
from erp.models import TransactionStatusLog


class LifecycleViewSetMixin:
    """
    Mixin for DRF ViewSets whose model inherits VerifiableModel.
    Requires `lifecycle_transaction_type` class attribute (e.g., 'VOUCHER').

    Adds these actions:
      POST /{id}/lock/
      POST /{id}/unlock/       (requires ?comment=...)
      POST /{id}/verify/
      POST /{id}/unverify/     (requires ?comment=...)
      GET  /{id}/lifecycle_history/
    """
    lifecycle_transaction_type = None  # Must be set by subclass

    def _get_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        return xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR')

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        if not self.lifecycle_transaction_type:
            return Response({"error": "lifecycle_transaction_type not configured"}, status=400)
        instance = self.get_object()
        try:
            result = TransactionLifecycleService.lock(
                instance, self.lifecycle_transaction_type, request.user,
                comment=request.data.get('comment'),
                ip_address=self._get_ip(request)
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def unlock(self, request, pk=None):
        if not self.lifecycle_transaction_type:
            return Response({"error": "lifecycle_transaction_type not configured"}, status=400)
        instance = self.get_object()
        comment = request.data.get('comment', '')
        try:
            result = TransactionLifecycleService.unlock(
                instance, self.lifecycle_transaction_type, request.user,
                comment=comment, ip_address=self._get_ip(request)
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        if not self.lifecycle_transaction_type:
            return Response({"error": "lifecycle_transaction_type not configured"}, status=400)
        instance = self.get_object()
        try:
            result = TransactionLifecycleService.verify(
                instance, self.lifecycle_transaction_type, request.user,
                comment=request.data.get('comment'),
                ip_address=self._get_ip(request)
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def unverify(self, request, pk=None):
        if not self.lifecycle_transaction_type:
            return Response({"error": "lifecycle_transaction_type not configured"}, status=400)
        instance = self.get_object()
        comment = request.data.get('comment', '')
        try:
            result = TransactionLifecycleService.unverify(
                instance, self.lifecycle_transaction_type, request.user,
                comment=comment, ip_address=self._get_ip(request)
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['get'])
    def lifecycle_history(self, request, pk=None):
        if not self.lifecycle_transaction_type:
            return Response({"error": "lifecycle_transaction_type not configured"}, status=400)
        instance = self.get_object()
        logs = TransactionLifecycleService.get_history(
            self.lifecycle_transaction_type, instance.pk
        )
        data = [{
            'action': log.action,
            'level': log.level,
            'performed_by': log.performed_by.username if log.performed_by else None,
            'performed_at': log.performed_at.isoformat(),
            'comment': log.comment,
        } for log in logs]
        return Response(data)
