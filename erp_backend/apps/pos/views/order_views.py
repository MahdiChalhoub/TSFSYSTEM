from .base import (
    TenantModelViewSet
)
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status as http_status
from django.core.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied

from apps.pos.models import Order
from apps.pos.serializers import OrderSerializer
from apps.pos.services.workflow_service import SalesWorkflowService, WorkflowError
from apps.pos.services.permission_service import SalesPermissionService
from apps.inventory.mixins.branch_scoped import BranchScopedMixin


class OrderViewSet(BranchScopedMixin, TenantModelViewSet):
    """CRUD for sales/purchase orders + workflow state machine actions. Branch-scoped."""
    queryset = Order.objects.select_related('contact', 'user', 'site', 'branch').prefetch_related(
        'lines', 'payments_received', 'payments_made', 'deliveries', 'returns', 'purchase_returns'
    ).all()
    serializer_class = OrderSerializer
    branch_field = 'branch'
    warehouse_field = 'site'
    # Expose all 4 axes as filter fields
    filterset_fields = [
        'type', 'status',
        'order_status', 'delivery_status', 'payment_status', 'invoice_status',
        'contact', 'user',
    ]
    search_fields = ['ref_code', 'invoice_number', 'notes']
    ordering_fields = ['created_at', 'total_amount', 'order_status', 'payment_status']

    @action(detail=True, methods=['post'], url_path='workflow')
    def workflow(self, request, pk=None):
        """
        POST /pos/orders/{id}/workflow/
        Body: { "action": "<transition_name>", "reason": "optional", "amount": optional_float }

        Supported actions:
          confirm        — DRAFT → CONFIRMED
          processing     — CONFIRMED → PROCESSING
          deliver        — PENDING → DELIVERED
          deliver_partial— PENDING → PARTIAL
          return         — DELIVERED → RETURNED
          pay            — UNPAID → PAID (pass amount for partial)
          write_off      — UNPAID|PARTIAL → WRITTEN_OFF
          generate_invoice
          send_invoice
          cancel         — any open state → CANCELLED
        """
        order = self.get_object()
        act = request.data.get('action', '').strip().lower()
        reason = request.data.get('reason', '')
        amount = request.data.get('amount', None)
        warehouse_id = request.data.get('warehouse_id', None)
        user = request.user

        try:
            if act == 'confirm':
                SalesPermissionService.require(user, 'sales.confirm_order')
                SalesWorkflowService.confirm_order(order, user=user, warehouse_id=warehouse_id)

            elif act == 'processing':
                SalesPermissionService.require(user, 'sales.confirm_order')
                SalesWorkflowService.mark_processing(order, user=user)

            elif act == 'deliver':
                SalesPermissionService.require(user, 'sales.mark_delivered')
                SalesWorkflowService.mark_delivered(order, partial=False, user=user)

            elif act == 'deliver_partial':
                SalesPermissionService.require(user, 'sales.mark_delivered')
                SalesWorkflowService.mark_delivered(order, partial=True, user=user)

            elif act == 'return':
                SalesPermissionService.require(user, 'sales.mark_delivered')
                SalesWorkflowService.mark_returned(order, user=user)

            elif act == 'pay':
                SalesPermissionService.require(user, 'sales.mark_paid')
                from decimal import Decimal
                amt = Decimal(str(amount)) if amount is not None else None
                SalesWorkflowService.mark_paid(order, amount_paid=amt, user=user)

            elif act == 'write_off':
                SalesPermissionService.require(user, 'sales.write_off')
                SalesWorkflowService.mark_written_off(order, reason=reason, user=user)

            elif act == 'generate_invoice':
                SalesPermissionService.require(user, 'sales.generate_invoice')
                SalesWorkflowService.generate_invoice(order, user=user)

            elif act == 'send_invoice':
                SalesPermissionService.require(user, 'sales.generate_invoice')
                SalesWorkflowService.send_invoice(order, user=user)

            elif act == 'cancel':
                SalesPermissionService.require(user, 'sales.cancel_order')
                SalesWorkflowService.cancel_order(order, reason=reason, user=user)

            else:
                return Response(
                    {'error': f"Unknown workflow action: '{act}'. See API docs for supported values."},
                    status=http_status.HTTP_400_BAD_REQUEST
                )

        except PermissionDenied as e:
            return Response({'error': str(e)}, status=http_status.HTTP_403_FORBIDDEN)

        except (WorkflowError, ValidationError) as e:
            msg = e.message if hasattr(e, 'message') else str(e)
            return Response({'error': msg}, status=http_status.HTTP_400_BAD_REQUEST)

        # Reload with full related data for response
        order.refresh_from_db()
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=http_status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='audit')
    def audit_log(self, request, pk=None):
        """
        GET /pos/orders/{id}/audit/

        Returns the full SalesAuditLog for an order, newest-first.
        Optional query params:
          ?action_type=ORDER_CONFIRMED   — filter by action type
          ?limit=50                      — max rows (default 100)
        """
        order = self.get_object()
        from apps.pos.models.audit_models import SalesAuditLog

        qs = SalesAuditLog.objects.filter(order=order)

        action_type = request.query_params.get('action_type')
        if action_type:
            qs = qs.filter(action_type=action_type)

        limit = min(int(request.query_params.get('limit', 100)), 500)
        qs = qs.select_related('actor').order_by('-created_at')[:limit]

        data = [
            {
                'id':                  entry.id,
                'action_type':         entry.action_type,
                'summary':             entry.summary,
                'actor_name':          entry.actor_name or (entry.actor.username if entry.actor else 'System'),
                'diff':                entry.diff,
                'order_status_snap':   entry.order_status_snap,
                'delivery_status_snap':entry.delivery_status_snap,
                'payment_status_snap': entry.payment_status_snap,
                'invoice_status_snap': entry.invoice_status_snap,
                'extra':               entry.extra,
                'created_at':          entry.created_at.isoformat(),
            }
            for entry in qs
        ]
        return Response({'results': data, 'count': len(data)}, status=http_status.HTTP_200_OK)

    # ── Gap 5: Payment Reconciliation ─────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='payments')
    def payments(self, request, pk=None):
        """
        GET  /pos/orders/{id}/payments/   — reconciliation summary for this order
        POST /pos/orders/{id}/payments/   — reconcile/write_off/refund a leg

        POST body:
          {
            "action":    "reconcile" | "write_off" | "refund",
            "leg_id":    <int>,
            "reference": "<string>",      # for reconcile
            "amount":    <decimal>,       # for write_off
            "reason":    "<string>",      # for write_off / refund
          }
        """
        order = self.get_object()
        from apps.pos.services.reconciliation_service import PaymentReconciliationService

        if request.method == 'GET':
            summary = PaymentReconciliationService.get_summary(order)
            return Response(summary, status=http_status.HTTP_200_OK)

        # POST — reconciliation actions (require payment-management permission)
        SalesPermissionService.require(request.user, 'sales.process_return')

        act      = request.data.get('action', '').strip().lower()
        leg_id   = request.data.get('leg_id')
        reason   = request.data.get('reason', '')
        reference= request.data.get('reference', '')
        amount   = request.data.get('amount', None)

        if not leg_id:
            return Response({'error': 'leg_id is required.'}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            if act == 'reconcile':
                leg = PaymentReconciliationService.reconcile(
                    organization=order.organization,
                    leg_id=int(leg_id),
                    reference=reference,
                    user=request.user,
                )
                return Response({'status': leg.status, 'leg_id': leg.id}, status=http_status.HTTP_200_OK)

            elif act == 'write_off':
                if amount is None:
                    return Response({'error': 'amount is required for write_off.'}, status=http_status.HTTP_400_BAD_REQUEST)
                from decimal import Decimal
                leg = PaymentReconciliationService.write_off(
                    organization=order.organization,
                    leg_id=int(leg_id),
                    amount=Decimal(str(amount)),
                    reason=reason,
                    user=request.user,
                )
                return Response({'status': leg.status, 'leg_id': leg.id, 'write_off': str(leg.write_off)}, status=http_status.HTTP_200_OK)

            elif act == 'refund':
                leg = PaymentReconciliationService.refund(
                    organization=order.organization,
                    leg_id=int(leg_id),
                    reason=reason,
                    user=request.user,
                )
                return Response({'status': leg.status, 'leg_id': leg.id}, status=http_status.HTTP_200_OK)

            else:
                return Response(
                    {'error': f"Unknown action '{act}'. Use reconcile | write_off | refund."},
                    status=http_status.HTTP_400_BAD_REQUEST
                )

        except ValidationError as e:
            return Response({'error': str(e)}, status=http_status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
