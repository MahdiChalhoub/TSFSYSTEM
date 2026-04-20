"""
Procurement Request ViewSet
Lifecycle: PENDING → APPROVED → EXECUTED  or  REJECTED / CANCELLED.
Referenced by the PO Intelligence Grid's per-row Transfer ⇄ / Request 📨 actions.
"""
from django.utils import timezone
from rest_framework import status as drf_status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views import TenantModelViewSet
from apps.pos.models.procurement_request_models import ProcurementRequest
from apps.pos.serializers.procurement_request_serializers import ProcurementRequestSerializer


class ProcurementRequestViewSet(TenantModelViewSet):
    queryset = ProcurementRequest.objects.all()
    serializer_class = ProcurementRequestSerializer

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            requested_by=self.request.user,
            status='PENDING',
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response(
                {'detail': f'Cannot approve — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'APPROVED'
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response(
                {'detail': f'Cannot reject — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'REJECTED'
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.notes = (req.notes or '') + f"\nRejected: {request.data.get('reason', '')}"
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'notes'])
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Mark approved request as executed — does NOT auto-create the transfer/PO,
        that's the operator's decision. Just flips the lifecycle state."""
        req = self.get_object()
        if req.status != 'APPROVED':
            return Response(
                {'detail': f'Cannot execute — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'EXECUTED'
        req.save(update_fields=['status'])
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        req = self.get_object()
        if req.status in ('EXECUTED', 'CANCELLED'):
            return Response(
                {'detail': f'Already in terminal state {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'CANCELLED'
        req.save(update_fields=['status'])
        return Response(self.get_serializer(req).data)
