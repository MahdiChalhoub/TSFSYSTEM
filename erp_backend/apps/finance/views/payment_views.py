from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id,
    Organization
)
from kernel.lifecycle.viewsets import LifecycleViewSetMixin
from apps.finance.payment_models import Payment, CustomerBalance, SupplierBalance
from apps.finance.invoice_models import Invoice
from apps.finance.serializers import PaymentSerializer, CustomerBalanceSerializer, SupplierBalanceSerializer
from apps.finance.payment_service import PaymentService

class PaymentViewSet(LifecycleViewSetMixin, TenantModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    lifecycle_transaction_type = 'PAYMENT'

    @action(detail=False, methods=['post'])
    def supplier_payment(self, request):
        """Record a payment to a supplier."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            payment = PaymentService.record_supplier_payment(
                organization=organization,
                contact_id=request.data.get('contact_id'),
                amount=request.data.get('amount'),
                payment_date=request.data.get('payment_date'),
                payment_account_id=request.data.get('payment_account_id'),
                method=request.data.get('method', 'CASH'),
                description=request.data.get('description'),
                supplier_invoice_id=request.data.get('supplier_invoice_id'),
                scope=request.data.get('scope', 'OFFICIAL'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PaymentSerializer(payment).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def customer_receipt(self, request):
        """Record a receipt from a customer."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            payment = PaymentService.record_customer_receipt(
                organization=organization,
                contact_id=request.data.get('contact_id'),
                amount=request.data.get('amount'),
                payment_date=request.data.get('payment_date'),
                payment_account_id=request.data.get('payment_account_id'),
                method=request.data.get('method', 'CASH'),
                description=request.data.get('description'),
                sales_order_id=request.data.get('sales_order_id'),
                scope=request.data.get('scope', 'OFFICIAL'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PaymentSerializer(payment).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['get'])
    def aged_receivables(self, request):
        """Get aged receivables report."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        return Response(PaymentService.get_aged_receivables(organization))

    @action(detail=False, methods=['get'])
    def aged_payables(self, request):
        """Get aged payables report."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        return Response(PaymentService.get_aged_payables(organization))

    @action(detail=True, methods=['post'], url_path='allocate-to-invoice')
    def allocate_to_invoice(self, request, pk=None):
        """Allocate (part of) a payment to an invoice."""
        payment = self.get_object()
        invoice_id = request.data.get('invoice_id')
        amount = request.data.get('amount')
        if not invoice_id or not amount:
            return Response({'error': 'invoice_id and amount are required'}, status=400)
        try:
            invoice = Invoice.objects.get(id=invoice_id, tenant_id=payment.organization_id)
            from apps.finance.invoice_service import InvoiceService
            allocation = InvoiceService.allocate_payment(payment, invoice, amount)
            return Response({
                'allocation_id': allocation.id,
                'payment': PaymentSerializer(payment).data,
                'invoice_balance': float(invoice.balance_due),
                'invoice_status': invoice.status,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['get'], url_path='payment-summary')
    def payment_summary(self, request, pk=None):
        """Get allocation summary for a payment."""
        payment = self.get_object()
        allocations = payment.allocations.select_related('invoice').all()
        allocated = sum(a.allocated_amount for a in allocations)
        return Response({
            'payment_id': payment.id,
            'total_amount': float(payment.amount),
            'allocated_amount': float(allocated),
            'unallocated_amount': float(payment.amount - allocated),
            'allocations': [
                {
                    'invoice_id': a.invoice_id,
                    'invoice_number': a.invoice.invoice_number,
                    'allocated_amount': float(a.allocated_amount),
                    'allocated_at': a.allocated_at.isoformat() if a.allocated_at else None,
                }
                for a in allocations
            ],
        })

    @action(detail=False, methods=['post'], url_path='check-overdue')
    def check_overdue(self, request):
        """Trigger overdue invoice detection."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'Tenant context missing'}, status=400)
        organization = Organization.objects.get(id=organization_id)
        from apps.finance.invoice_service import InvoiceService
        count = InvoiceService.check_overdue_invoices(organization)
        return Response({'overdue_count': count, 'message': f'{count} invoices marked overdue'})


from rest_framework import viewsets

class CustomerBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CustomerBalance.objects.all()
    serializer_class = CustomerBalanceSerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return super().get_queryset().filter(tenant_id=org_id)

class SupplierBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SupplierBalance.objects.all()
    serializer_class = SupplierBalanceSerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return super().get_queryset().filter(tenant_id=org_id)


# =============================================================================
# FLUTTERWAVE WEBHOOK
# =============================================================================

import logging
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.authentication import BasicAuthentication

webhook_logger = logging.getLogger('finance.webhooks')


class FlutterwaveWebhookView(APIView):
    """
    Receives asynchronous payment confirmations from Flutterwave.

    Endpoint: POST /api/finance/webhooks/flutterwave/

    Security:
        - Validates verif-hash header against org's GatewayConfig.webhook_secret
        - Only processes 'charge.completed' events
        - Idempotent: re-processing same tx_ref is safe (already PAID check)

    Flow:
        1. Flutterwave POSTs payload after customer completes mobile money payment
        2. We validate signature
        3. We verify transaction via Flutterwave API (don't trust payload alone)
        4. We mark the ClientOrder as PAID and post loyalty points
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Webhook — no session/token auth

    def post(self, request, *args, **kwargs):
        # ── 1. Read signature header ──────────────────────────────────────
        verif_hash = request.headers.get('verif-hash', '')
        payload_bytes = request.body

        if not verif_hash:
            webhook_logger.warning("[Flutterwave Webhook] Missing verif-hash header")
            return Response({'error': 'Missing verif-hash'}, status=403)

        # ── 2. Resolve org from tx_ref (order_number prefix) ─────────────
        import json
        try:
            payload = json.loads(payload_bytes)
        except Exception:
            return Response({'error': 'Invalid JSON'}, status=400)

        tx_ref = payload.get('data', {}).get('tx_ref', '') or payload.get('txRef', '')
        event_type = payload.get('event', '')

        if event_type != 'charge.completed':
            webhook_logger.info(f"[Flutterwave Webhook] Ignored event: {event_type}")
            return Response({'status': 'ignored'})

        if not tx_ref:
            return Response({'error': 'Missing tx_ref'}, status=400)

        # ── 3. Find the matching order ────────────────────────────────────
        from apps.client_portal.models import ClientOrder
        order = ClientOrder.objects.filter(order_number=tx_ref).first()
        if not order:
            webhook_logger.error(f"[Flutterwave Webhook] Order not found for tx_ref: {tx_ref}")
            return Response({'error': 'Order not found'}, status=404)

        # ── 4. Validate signature against org GatewayConfig ───────────────
        from apps.finance.flutterwave_gateway import FlutterwaveGateway
        try:
            from apps.finance.gateway_models import GatewayConfig
            cfg = GatewayConfig.objects.filter(
                tenant_id=order.organization_id,
                gateway_type='FLUTTERWAVE',
                is_active=True,
            ).first()
            secret_hash = cfg.get_webhook_secret() if cfg else None
        except Exception:
            secret_hash = None

        if not FlutterwaveGateway.validate_webhook_signature(payload_bytes, verif_hash, secret_hash or ''):
            webhook_logger.warning(f"[Flutterwave Webhook] Invalid signature for order {tx_ref}")
            return Response({'error': 'Invalid signature'}, status=403)

        # ── 5. Already paid? Idempotent. ──────────────────────────────────
        if order.payment_status == 'PAID':
            webhook_logger.info(f"[Flutterwave Webhook] Order {tx_ref} already PAID — skipping")
            return Response({'status': 'already_processed'})

        # ── 6. Verify transaction with Flutterwave API ────────────────────
        transaction_id = payload.get('data', {}).get('id')
        if transaction_id:
            gateway = FlutterwaveGateway(order.organization_id)
            verification = gateway.verify_transaction(transaction_id)
            if verification.get('status') != 'successful':
                webhook_logger.warning(
                    f"[Flutterwave Webhook] Verification failed for tx {transaction_id}: {verification}"
                )
                return Response({'error': 'Transaction verification failed'}, status=400)
        else:
            webhook_logger.warning(f"[Flutterwave Webhook] No transaction_id in payload for {tx_ref}")

        # ── 7. Confirm payment ────────────────────────────────────────────
        from apps.finance.payment_gateway import PaymentGatewayService
        PaymentGatewayService.confirm_manual_payment(order)
        webhook_logger.info(f"[Flutterwave Webhook] Order {tx_ref} marked PAID via webhook")

        return Response({'status': 'payment_confirmed', 'order_number': tx_ref})
