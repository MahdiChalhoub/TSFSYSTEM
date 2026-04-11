"""
Views for Product Governance — PriceChangeRequest workflow and ProductAuditTrail.
"""
from decimal import Decimal
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views_base import TenantModelViewSet
from apps.inventory.models import PriceChangeRequest, ProductAuditTrail, Product, PriceApprovalPolicy
from apps.inventory.serializers.governance_serializers import (
    PriceChangeRequestSerializer, ProductAuditTrailSerializer,
    PriceApprovalPolicySerializer,
)
from apps.inventory.services.product_completeness import ProductCompletenessService


def _log_audit(product, event_type, actor=None, details=None):
    """Helper to create audit trail entries."""
    ProductAuditTrail.objects.create(
        organization=product.organization,
        product=product,
        event_type=event_type,
        actor=actor,
        details=details or {},
    )


class PriceChangeRequestViewSet(TenantModelViewSet):
    """
    CRUD + workflow actions for price change requests.

    Workflow:
    1. User creates request (PENDING)
    2. Manager approves/rejects (APPROVED/REJECTED)
    3. If approved, apply endpoint pushes price to product (APPLIED)
    """
    queryset = PriceChangeRequest.objects.select_related(
        'product', 'requested_by', 'reviewed_by'
    ).all()
    serializer_class = PriceChangeRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'product', 'change_type']
    search_fields = ['product__name', 'product__sku', 'reason']
    ordering_fields = ['requested_at', 'proposed_price_ttc', 'status']

    def perform_create(self, serializer):
        """Auto-fill current prices from product and set requested_by."""
        product_id = self.request.data.get('product')
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return

        instance = serializer.save(
            organization=product.organization,
            requested_by=self.request.user,
            current_price_ht=product.selling_price_ht or 0,
            current_price_ttc=product.selling_price_ttc or 0,
        )

        # Audit trail
        _log_audit(product, 'PRICE_REQUEST', self.request.user, {
            'pcr_id': instance.pk,
            'proposed_ttc': str(instance.proposed_price_ttc),
            'current_ttc': str(instance.current_price_ttc),
            'reason': instance.reason,
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Manager approves a pending price change request."""
        pcr = self.get_object()
        if pcr.status != 'PENDING':
            return Response(
                {'error': f'Cannot approve: status is {pcr.status}, expected PENDING'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pcr.status = 'APPROVED'
        pcr.reviewed_by = request.user
        pcr.reviewed_at = timezone.now()
        pcr.review_notes = request.data.get('notes', '')
        pcr.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_notes'])

        _log_audit(pcr.product, 'PRICE_APPROVED', request.user, {
            'pcr_id': pcr.pk,
            'proposed_ttc': str(pcr.proposed_price_ttc),
            'notes': pcr.review_notes,
        })

        return Response(PriceChangeRequestSerializer(pcr).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Manager rejects a pending price change request."""
        pcr = self.get_object()
        if pcr.status != 'PENDING':
            return Response(
                {'error': f'Cannot reject: status is {pcr.status}, expected PENDING'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pcr.status = 'REJECTED'
        pcr.reviewed_by = request.user
        pcr.reviewed_at = timezone.now()
        pcr.review_notes = request.data.get('notes', '')
        pcr.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_notes'])

        _log_audit(pcr.product, 'PRICE_REJECTED', request.user, {
            'pcr_id': pcr.pk,
            'notes': pcr.review_notes,
        })

        return Response(PriceChangeRequestSerializer(pcr).data)

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Apply an approved price change to the product."""
        pcr = self.get_object()
        if pcr.status != 'APPROVED':
            return Response(
                {'error': f'Cannot apply: status is {pcr.status}, expected APPROVED'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Apply price change
        old_ttc = pcr.product.selling_price_ttc
        pcr.apply_price()

        # Refresh completeness (price change may affect level)
        ProductCompletenessService.refresh(pcr.product, save=True)

        # Auto-unverify after price change (significant modification)
        if pcr.product.is_verified:
            pcr.product.is_verified = False
            pcr.product.verified_at = None
            pcr.product.verified_by = None
            pcr.product.save(update_fields=['is_verified', 'verified_at', 'verified_by'])
            _log_audit(pcr.product, 'UNVERIFIED', request.user, {
                'reason': 'Auto-unverified after price change',
                'pcr_id': pcr.pk,
            })

        _log_audit(pcr.product, 'PRICE_APPLIED', request.user, {
            'pcr_id': pcr.pk,
            'old_ttc': str(old_ttc),
            'new_ttc': str(pcr.proposed_price_ttc),
        })

        # Auto-generate print label task
        from apps.inventory.services.product_task_engine import ProductTaskEngine
        ProductTaskEngine.on_price_applied(pcr, user=request.user)

        return Response(PriceChangeRequestSerializer(pcr).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Requester cancels their own pending request."""
        pcr = self.get_object()
        if pcr.status != 'PENDING':
            return Response(
                {'error': f'Cannot cancel: status is {pcr.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pcr.status = 'CANCELLED'
        pcr.save(update_fields=['status'])
        return Response(PriceChangeRequestSerializer(pcr).data)


class ProductAuditTrailViewSet(TenantModelViewSet):
    """Read-only view of the product governance audit trail."""
    queryset = ProductAuditTrail.objects.select_related(
        'product', 'actor'
    ).all()
    serializer_class = ProductAuditTrailSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['event_type', 'product']
    ordering_fields = ['timestamp']
    http_method_names = ['get', 'head', 'options']  # Read-only


class PriceApprovalPolicyViewSet(TenantModelViewSet):
    """
    CRUD for price approval policies.
    Policies define when price changes can be auto-approved vs require manual review.
    """
    queryset = PriceApprovalPolicy.objects.select_related('applies_to_user').all()
    serializer_class = PriceApprovalPolicySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['is_active', 'action']
    search_fields = ['name', 'applies_to_role']
    ordering_fields = ['priority', 'name', 'created_at']
    ordering = ['priority']

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle a policy's is_active flag."""
        policy = self.get_object()
        policy.is_active = not policy.is_active
        policy.save(update_fields=['is_active'])
        return Response(PriceApprovalPolicySerializer(policy).data)
