from .base import (
    TenantModelViewSet
)
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status as http_status
from django.core.exceptions import ValidationError

from apps.pos.models import Order
from apps.pos.serializers import OrderSerializer
from apps.pos.services.workflow_service import SalesWorkflowService, WorkflowError


class OrderViewSet(TenantModelViewSet):
    """CRUD for sales/purchase orders + workflow state machine actions."""
    queryset = Order.objects.select_related('contact', 'user', 'site').prefetch_related(
        'lines', 'payments_received', 'payments_made', 'deliveries', 'returns', 'purchase_returns'
    ).all()
    serializer_class = OrderSerializer
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
        user = request.user

        try:
            if act == 'confirm':
                SalesWorkflowService.confirm_order(order, user=user)

            elif act == 'processing':
                SalesWorkflowService.mark_processing(order, user=user)

            elif act == 'deliver':
                SalesWorkflowService.mark_delivered(order, partial=False, user=user)

            elif act == 'deliver_partial':
                SalesWorkflowService.mark_delivered(order, partial=True, user=user)

            elif act == 'return':
                SalesWorkflowService.mark_returned(order, user=user)

            elif act == 'pay':
                from decimal import Decimal
                amt = Decimal(str(amount)) if amount is not None else None
                SalesWorkflowService.mark_paid(order, amount_paid=amt, user=user)

            elif act == 'write_off':
                SalesWorkflowService.mark_written_off(order, reason=reason, user=user)

            elif act == 'generate_invoice':
                SalesWorkflowService.generate_invoice(order, user=user)

            elif act == 'send_invoice':
                SalesWorkflowService.send_invoice(order, user=user)

            elif act == 'cancel':
                SalesWorkflowService.cancel_order(order, reason=reason, user=user)

            else:
                return Response(
                    {'error': f"Unknown workflow action: '{act}'. See API docs for supported values."},
                    status=http_status.HTTP_400_BAD_REQUEST
                )

        except (WorkflowError, ValidationError) as e:
            msg = e.message if hasattr(e, 'message') else str(e)
            return Response({'error': msg}, status=http_status.HTTP_400_BAD_REQUEST)

        # Reload with full related data for response
        order.refresh_from_db()
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=http_status.HTTP_200_OK)
