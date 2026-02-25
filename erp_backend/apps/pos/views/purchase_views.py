from .base import (
    viewsets, status, Response, action, get_current_tenant_id,
    Organization, PDFService, HttpResponse
)
from apps.pos.models import Order
from apps.pos.models import PurchaseOrder, PurchaseOrderLine
from apps.pos.services import PurchaseService
from apps.pos.serializers import (
    OrderSerializer, PurchaseOrderSerializer, PurchaseOrderLineSerializer
)

class PurchaseViewSet(viewsets.ViewSet):
    """Handles Purchase Order (PO) operations."""
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        qs = Order.objects.filter(organization_id=organization_id, type='PURCHASE').select_related('contact', 'user').order_by('-created_at')
        return Response(OrderSerializer(qs, many=True).data)

    def retrieve(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        try:
            order = Order.objects.select_related('contact', 'user', 'site').get(pk=pk, organization_id=organization_id, type='PURCHASE')
            return Response(OrderSerializer(order).data)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)

    def create(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            order = PurchaseService.create_purchase_order(
                organization=organization,
                supplier_id=request.data.get('supplierId'),
                site_id=request.data.get('siteId'),
                warehouse_id=request.data.get('warehouseId'),
                scope=request.data.get('scope', 'OFFICIAL'),
                lines=request.data.get('lines', []),
                notes=request.data.get('notes'),
                ref_code=request.data.get('refCode'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['get'])
    def print(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization"}, status=400)
        try:
            order = Order.objects.get(pk=pk, organization_id=organization_id, type='PURCHASE')
            if PDFService is None:
                return Response({"error": "PDF generation not available (xhtml2pdf not installed)"}, status=501)
            context = PDFService.get_purchase_order_context(order)
            pdf_content = PDFService.render_to_pdf('pos/purchase_order.html', context)
            
            if pdf_content:
                filename = f"PO_{order.ref_code or order.id}.pdf"
                if order.status == 'DRAFT':
                    filename = f"RFQ_{order.ref_code or order.id}.pdf"
                
                response = HttpResponse(pdf_content, content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                return response
            return Response({"error": "Failed to generate PDF"}, status=500)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            warehouse_id = request.data.get('warehouse_id')
            order = PurchaseService.receive_po(organization, pk, warehouse_id)
            return Response({"message": "Goods Received", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def invoice(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            invoice_num = request.data.get('invoice_number')
            order = PurchaseService.invoice_po(organization, pk, invoice_num)
            return Response({"message": "PO Invoiced", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def quick_purchase(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            order = PurchaseService.quick_purchase(
                organization=organization,
                supplier_id=request.data.get('supplierId'),
                warehouse_id=request.data.get('warehouseId'),
                site_id=request.data.get('siteId'),
                scope=request.data.get('scope'),
                invoice_price_type=request.data.get('invoicePriceType'),
                vat_recoverable=request.data.get('vatRecoverable'),
                lines=request.data.get('lines', []),
                notes=request.data.get('notes'),
                ref_code=request.data.get('refCode'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response({"success": True, "orderId": order.id})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """ViewSet for the dedicated PurchaseOrder model with 10-state lifecycle."""
    queryset = PurchaseOrder.objects.select_related(
        'supplier', 'site', 'warehouse', 'created_by', 'assigned_to', 'approved_by'
    ).prefetch_related('lines', 'lines__product').all()
    serializer_class = PurchaseOrderSerializer

    @action(detail=False, methods=['get'], url_path='pending-invoice')
    def pending_invoice(self, request):
        org_id = get_current_tenant_id()
        qs = self.queryset.filter(organization_id=org_id, status='RECEIVED')
        return Response(PurchaseOrderSerializer(qs, many=True).data)

    def get_queryset(self):
        org_id = get_current_tenant_id()
        qs = self.queryset.filter(organization_id=org_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
            
        supplier_id = self.request.query_params.get('supplier')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
            
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        serializer.save(
            organization=organization,
            created_by=self.request.user if self.request.user.is_authenticated else None
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit PO for approval."""
        po = self.get_object()
        po.status = 'SUBMITTED'
        po.save(update_fields=['status'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted PO."""
        po = self.get_object()
        po.status = 'APPROVED'
        po.approved_by = request.user if request.user.is_authenticated else None
        po.save(update_fields=['status', 'approved_by'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a submitted PO."""
        po = self.get_object()
        po.status = 'REJECTED'
        po.notes = f"{po.notes}\nRejected: {request.data.get('reason', '')}"
        po.save(update_fields=['status', 'notes'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='send-to-supplier')
    def send_to_supplier(self, request, pk=None):
        """Mark PO as ordered / sent to supplier."""
        po = self.get_object()
        po.status = 'ORDERED'
        po.save(update_fields=['status'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='receive-line')
    def receive_line(self, request, pk=None):
        """Receive goods for a specific line."""
        po = self.get_object()
        line_id = request.data.get('line_id')
        qty = Decimal(str(request.data.get('quantity', 0)))
        
        try:
            line = po.lines.get(id=line_id)
            line.received_quantity += qty
            line.save(update_fields=['received_quantity'])
            
            # Check if all lines fully received
            if all(l.received_quantity >= l.quantity for l in po.lines.all()):
                po.status = 'RECEIVED'
                po.save(update_fields=['status'])
                
            return Response(PurchaseOrderSerializer(po).data)
        except PurchaseOrderLine.DoesNotExist:
            return Response({"error": "Line not found"}, status=404)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a PO."""
        po = self.get_object()
        po.status = 'CANCELLED'
        po.save(update_fields=['status'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='mark-invoiced')
    def mark_invoiced(self, request, pk=None):
        """Mark PO as invoiced."""
        po = self.get_object()
        po.status = 'INVOICED'
        po.invoice_number = request.data.get('invoice_number')
        po.save(update_fields=['status', 'invoice_number'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark PO as completed."""
        po = self.get_object()
        po.status = 'COMPLETED'
        po.save(update_fields=['status'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='add-line')
    def add_line(self, request, pk=None):
        """Add a line item to a DRAFT PO."""
        po = self.get_object()
        if po.status != 'DRAFT':
            return Response({"error": "Only DRAFT POs can be modified"}, status=400)
            
        serializer = PurchaseOrderLineSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(order=po, organization=po.organization)
            po.recalculate_totals()
            return Response(PurchaseOrderSerializer(po).data)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['delete'], url_path='remove-line/(?P<line_id>[0-9]+)')
    def remove_line(self, request, pk=None, line_id=None):
        """Remove a line from a DRAFT PO."""
        po = self.get_object()
        if po.status != 'DRAFT':
            return Response({"error": "Only DRAFT POs can be modified"}, status=400)
            
        deleted, _ = PurchaseOrderLine.objects.filter(id=line_id, order=po).delete()
        if deleted:
            po.recalculate_totals()
            return Response(PurchaseOrderSerializer(po).data)
        return Response({"error": "Line not found"}, status=404)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """PO dashboard stats."""
        org_id = get_current_tenant_id()
        from django.db.models import Count, Sum
        stats = PurchaseOrder.objects.filter(organization_id=org_id).values('status').annotate(
            count=Count('id'),
            total=Sum('total_ttc')
        )
        return Response(list(stats))


class PurchaseOrderLineViewSet(viewsets.ModelViewSet):
    """Direct CRUD for PO lines."""
    queryset = PurchaseOrderLine.objects.select_related('product', 'warehouse', 'order').all()
    serializer_class = PurchaseOrderLineSerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return self.queryset.filter(organization_id=org_id)
