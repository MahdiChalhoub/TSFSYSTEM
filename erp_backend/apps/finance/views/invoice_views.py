from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id,
    Organization
)
from apps.finance.invoice_models import Invoice, InvoiceLine, PaymentAllocation
from apps.finance.serializers import (
    InvoiceSerializer, InvoiceLineSerializer, PaymentAllocationSerializer
)
from kernel.performance import profile_view

class InvoiceViewSet(TenantModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer

    @profile_view
    def get_queryset(self):
        qs = super().get_queryset().select_related('contact', 'created_by', 'site', 'organization').prefetch_related('lines__product')
        # Filters
        inv_type = self.request.query_params.get('type')
        inv_status = self.request.query_params.get('status')
        contact_id = self.request.query_params.get('contact_id')
        sub_type = self.request.query_params.get('sub_type')
        if inv_type:
            qs = qs.filter(type=inv_type)
        if inv_status:
            qs = qs.filter(status=inv_status)
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        if sub_type:
            qs = qs.filter(sub_type=sub_type)
        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        # --- STRICT SCOPE ENFORCEMENT ---
        scope = request.data.get('scope', 'OFFICIAL')
        self.check_scope_permission(scope)

        try:
            lines_data = request.data.pop('lines', [])
            data = request.data.copy()

            # Snapshot contact info
            from erp.connector_registry import connector
            Contact = connector.require('crm.contacts.get_model', org_id=organization_id, source='finance.invoice')
            contact = Contact.objects.get(id=data.get('contact'), organization=organization)
            data.setdefault('contact_name', contact.name)
            data.setdefault('contact_email', contact.email)
            data.setdefault('contact_address', contact.address)
            data.setdefault('contact_vat_id', getattr(contact, 'tax_id', None))

            # Calculate due date from payment terms
            if data.get('issue_date') and data.get('payment_terms'):
                from datetime import datetime, timedelta
                TERM_DAYS = {
                    'IMMEDIATE': 0, 'NET_7': 7, 'NET_15': 15,
                    'NET_30': 30, 'NET_45': 45, 'NET_60': 60, 'NET_90': 90,
                }
                days = TERM_DAYS.get(data['payment_terms'], 30)
                if data['payment_terms'] == 'CUSTOM':
                    days = int(data.get('payment_terms_days', 30))
                data['payment_terms_days'] = days
                issue = datetime.strptime(data['issue_date'], '%Y-%m-%d').date() if isinstance(data['issue_date'], str) else data['issue_date']
                data.setdefault('due_date', str(issue + timedelta(days=days)))

            invoice = Invoice.objects.create(
                organization=organization,
                created_by=request.user if request.user.is_authenticated else None,
                **{k: v for k, v in data.items() if k not in ('organization',)}
            )

            # Create lines
            for i, line_data in enumerate(lines_data):
                InvoiceLine.objects.create(
                    organization=organization,
                    invoice=invoice,
                    sort_order=i,
                    **line_data
                )

            # Recalculate totals from lines
            if lines_data:
                invoice.recalculate_totals()

            return Response(InvoiceSerializer(invoice).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def send_invoice(self, request, pk=None):
        """Mark invoice as SENT and auto-generate invoice number."""
        invoice = self.get_object()
        if invoice.status != 'DRAFT':
            return Response({"error": "Only DRAFT invoices can be sent."}, status=400)
        invoice.status = 'SENT'
        invoice.save()  # Triggers auto-numbering in save()
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record a payment against this invoice with proper allocation."""
        invoice = self.get_object()
        amount = request.data.get('amount')
        method = request.data.get('method', 'CASH')
        payment_account_id = request.data.get('payment_account_id')
        if not amount:
            return Response({"error": "Amount is required."}, status=400)
        if not payment_account_id:
            # Fall back to simple record (no Payment object created)
            try:
                invoice.record_payment(amount)
                return Response(InvoiceSerializer(invoice).data)
            except Exception as e:
                return Response({"error": str(e)}, status=400)
        try:
            from apps.finance.invoice_service import InvoiceService
            payment, allocation = InvoiceService.record_payment_for_invoice(
                invoice=invoice,
                amount=amount,
                method=method,
                payment_account_id=payment_account_id,
                description=request.data.get('description'),
                reference=request.data.get('reference'),
                user=request.user if request.user.is_authenticated else None,
            )
            return Response({
                'invoice': InvoiceSerializer(invoice).data,
                'payment_id': payment.id,
                'allocation_id': allocation.id,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel_invoice(self, request, pk=None):
        """Cancel an unpaid invoice."""
        invoice = self.get_object()
        try:
            invoice.cancel()
            return Response(InvoiceSerializer(invoice).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        """Add a line item to the invoice."""
        invoice = self.get_object()
        if invoice.status not in ('DRAFT',):
            return Response({"error": "Lines can only be added to DRAFT invoices."}, status=400)
            
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)
        
        product_id = request.data.get('product')
        if product_id:
            try:
                from erp.connector_registry import connector
                Product = connector.require('inventory.products.get_model', org_id=organization_id, source='finance.invoice')
                if Product and not Product.objects.filter(id=product_id, organization=organization).exists():
                    return Response({"error": "Product not found or access denied."}, status=403)
            except Exception:
                pass  # Inventory module not available — skip product validation
                
        try:
            line = InvoiceLine.objects.create(
                organization=organization,
                invoice=invoice,
                **{k: v for k, v in request.data.items() if k not in ('organization', 'invoice')}
            )
            invoice.recalculate_totals()
            return Response(InvoiceLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['get'])
    @profile_view
    def dashboard(self, request):
        """Invoice dashboard stats."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "Tenant context missing"}, status=400)

        from django.db.models import Sum
        from django.utils import timezone

        qs = Invoice.objects.filter(organization_id=organization_id).only('id', 'status', 'balance_due', 'paid_amount')
        
        return Response({
            'total_invoices': qs.count(),
            'draft': qs.filter(status='DRAFT').count(),
            'sent': qs.filter(status='SENT').count(),
            'overdue': qs.filter(status='OVERDUE').count(),
            'paid': qs.filter(status='PAID').count(),
            'total_outstanding': float(qs.filter(
                status__in=['SENT', 'PARTIAL_PAID', 'OVERDUE']
            ).aggregate(s=Sum('balance_due'))['s'] or 0),
            'total_overdue': float(qs.filter(
                status='OVERDUE'
            ).aggregate(s=Sum('balance_due'))['s'] or 0),
            'total_received': float(qs.aggregate(s=Sum('paid_amount'))['s'] or 0),
        })


from rest_framework.exceptions import ValidationError

class InvoiceLineViewSet(TenantModelViewSet):
    queryset = InvoiceLine.objects.all()
    serializer_class = InvoiceLineSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        invoice_id = self.request.query_params.get('invoice_id')
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        invoice = serializer.validated_data.get('invoice')
        if invoice and invoice.organization_id != org_id:
            raise ValidationError("Cross-tenant Invoice assignment blocked.")
        serializer.save(organization_id=org_id)

    def perform_update(self, serializer):
        org_id = get_current_tenant_id()
        invoice = serializer.validated_data.get('invoice')
        if invoice and invoice.organization_id != org_id:
            raise ValidationError("Cross-tenant Invoice assignment blocked.")
        serializer.save(organization_id=org_id)


class PaymentAllocationViewSet(TenantModelViewSet):
    queryset = PaymentAllocation.objects.all()
    serializer_class = PaymentAllocationSerializer

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        invoice = serializer.validated_data.get('invoice')
        payment = serializer.validated_data.get('payment')
        if invoice and invoice.organization_id != org_id:
            raise ValidationError("Cross-tenant Invoice assignment blocked.")
        if payment and payment.organization_id != org_id:
            raise ValidationError("Cross-tenant Payment assignment blocked.")
        serializer.save(organization_id=org_id)

    def perform_update(self, serializer):
        org_id = get_current_tenant_id()
        invoice = serializer.validated_data.get('invoice')
        payment = serializer.validated_data.get('payment')
        if invoice and invoice.organization_id != org_id:
            raise ValidationError("Cross-tenant Invoice assignment blocked.")
        if payment and payment.organization_id != org_id:
            raise ValidationError("Cross-tenant Payment assignment blocked.")
        serializer.save(organization_id=org_id)
