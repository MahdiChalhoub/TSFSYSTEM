from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id,
    Organization
)
from apps.finance.payment_models import Payment, CustomerBalance, SupplierBalance
from apps.finance.invoice_models import Invoice
from apps.finance.serializers import PaymentSerializer, CustomerBalanceSerializer, SupplierBalanceSerializer
from apps.finance.payment_service import PaymentService

class PaymentViewSet(TenantModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

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
            invoice = Invoice.objects.get(id=invoice_id, organization_id=payment.organization_id)
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


class CustomerBalanceViewSet(TenantModelViewSet):
    queryset = CustomerBalance.objects.all()
    serializer_class = CustomerBalanceSerializer


class SupplierBalanceViewSet(TenantModelViewSet):
    queryset = SupplierBalance.objects.all()
    serializer_class = SupplierBalanceSerializer
