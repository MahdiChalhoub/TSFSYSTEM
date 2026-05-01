from .base import (
    viewsets, status, Response, action, get_current_tenant_id,
    Organization, PDFService, HttpResponse
)
from apps.pos.models import Order, PurchaseOrder, PurchaseOrderLine
from apps.pos.services import PurchaseService
from apps.pos.serializers import (
    OrderSerializer, PurchaseOrderSerializer, PurchaseOrderLineSerializer
)
from decimal import Decimal
from django.utils import timezone
from erp.connector_registry import connector

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
        'supplier', 'site', 'warehouse', 'created_by', 'approved_by'
    ).prefetch_related('lines', 'lines__product').all()
    serializer_class = PurchaseOrderSerializer

    @action(detail=False, methods=['get'], url_path='pending-invoice')
    def pending_invoice(self, request):
        org_id = get_current_tenant_id()
        qs = self.queryset.filter(organization_id=org_id, status='RECEIVED')
        return Response(PurchaseOrderSerializer(qs, many=True).data)

    def get_queryset(self):
        from django.db.models import Q
        org_id = get_current_tenant_id()
        qs = self.queryset.filter(organization_id=org_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        supplier_id = self.request.query_params.get('supplier')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        # Text search: po_number, supplier name, or notes
        query = self.request.query_params.get('query', '').strip()
        if query:
            qs = qs.filter(
                Q(po_number__icontains=query) |
                Q(supplier__name__icontains=query) |
                Q(notes__icontains=query)
            )

        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        # Pass scope for 3-tier numbering (DRAFT/INTERNAL/OFFICIAL)
        scope = self.request.data.get('scope', 'OFFICIAL')
        po = serializer.save(
            organization=organization,
            created_by=self.request.user if self.request.user.is_authenticated else None
        )
        po._scope = scope
        # Re-save if po_number wasn't generated (scope was not set during first save)
        if not po.po_number:
            po.save()

        # Handle nested lines from request payload
        lines_data = self.request.data.get('lines', [])
        for line_data in lines_data:
            product_id = line_data.get('product')
            quantity = Decimal(str(line_data.get('quantity', 0)))
            unit_price = Decimal(str(line_data.get('unit_price', 0)))
            tax_rate = Decimal(str(line_data.get('tax_rate', 0)))
            discount_percent = Decimal(str(line_data.get('discount_percent', 0)))

            if product_id and quantity > 0:
                PurchaseOrderLine.objects.create(
                    organization=organization,
                    order=po,
                    product_id=product_id,
                    quantity=quantity,
                    unit_price=unit_price,
                    tax_rate=tax_rate,
                    discount_percent=discount_percent,
                    warehouse=po.warehouse,
                )

        if lines_data:
            po.recalculate_totals()

    @action(detail=False, methods=['post'], url_path='auto-replenish')
    def auto_replenish(self, request):
        """Run the Min/Max Automated Replenishment Engine."""
        from apps.pos.services.replenishment_service import AutomatedReplenishmentService
        org_id = get_current_tenant_id()
        from erp.models import Organization
        organization = Organization.objects.get(id=org_id)
        
        try:
            result = AutomatedReplenishmentService.run_auto_replenishment(organization)
            return Response({
                'success': True,
                'message': f"Generated {result['pos_created']} Draft POs off {result['products_scanned']} products scanned.",
                'data': result
            })
        except Exception as e:
            return Response({'success': False, 'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        """Generic status-transition endpoint.
        Body: { "to": "<NEW_STATUS>", "reason"?: "..." }

        Routes through `PurchaseOrder.transition_to()` so the model's
        VALID_TRANSITIONS map and side-effect fields (timestamps, actor,
        rejection_reason) are honored. Without this, the frontend was
        falling back to a generic PATCH which assigned `status` directly,
        bypassing the validation and skipping per-stage book-keeping —
        that's why CONFIRMED → IN_TRANSIT clicks looked like a no-op.

        For transitions with their own dedicated endpoint (submit, approve,
        send-to-supplier, reject, cancel, complete, revert-to-draft), the
        frontend should still prefer those because they carry richer
        signals (supplier-balance updates, task creation, scope promotion).
        This endpoint covers the in-the-middle stages that lacked one:
        CONFIRMED, IN_TRANSIT, PARTIALLY_RECEIVED, RECEIVED, INVOICED,
        PARTIALLY_INVOICED.
        """
        po = self.get_object()
        new_status = (request.data.get('to') or '').upper().strip()
        reason = request.data.get('reason') or None
        if not new_status:
            return Response({"error": "`to` is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Idempotent: a same-state click is a no-op, not an error.
        # Common cause is a stale dropdown — the row showed the previous
        # status while the DB had already advanced. Returning the current
        # state lets the frontend just refresh; no spurious "Cannot
        # transition from X to X" toast.
        if po.status == new_status:
            return Response(PurchaseOrderSerializer(po).data)

        try:
            po.transition_to(
                new_status,
                user=request.user if request.user.is_authenticated else None,
                reason=reason,
            )
        except ValidationError as e:
            # Refresh from DB so the frontend can sync to truth even on
            # the error path. Surface the message + the actual current
            # status so the UI can re-render the dropdown correctly.
            po.refresh_from_db()
            return Response({
                "error": str(e.message if hasattr(e, 'message') else e),
                "current_status": po.status,
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit PO for approval — promotes DRAFT number to OFFICIAL/INTERNAL."""
        po = self.get_object()
        po._scope = request.data.get('scope', 'OFFICIAL')
        po.status = 'SUBMITTED'
        po.save()  # Full save triggers DFT→PO/IPO number promotion
        # ── Auto-Task: PURCHASE_ENTERED ──
        try:
            trigger_purchasing = connector.require('workspace.events.trigger_purchasing', org_id=0, source='pos')
            if trigger_purchasing:
                trigger_purchasing(
                    org_id=po.organization_id, organization=po.organization, event='PURCHASE_ENTERED',
                    reference=po.po_number or f'PO-{po.pk}',
                    amount=float(po.total_amount or 0),
                    site_id=po.site_id,
                    user=request.user if request.user.is_authenticated else None,
                )
        except Exception:
            pass
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted PO."""
        po = self.get_object()
        po.status = 'APPROVED'
        po.approved_by = request.user if request.user.is_authenticated else None
        po.save(update_fields=['status', 'approved_by'])
        # ── Auto-Task: PO_APPROVED ──
        try:
            trigger_purchasing = connector.require('workspace.events.trigger_purchasing', org_id=0, source='pos')
            if trigger_purchasing:
                trigger_purchasing(
                    org_id=po.organization_id, organization=po.organization, event='PO_APPROVED',
                    reference=po.po_number or f'PO-{po.pk}',
                    amount=float(po.total_amount or 0),
                    user=request.user if request.user.is_authenticated else None,
                )
        except Exception:
            pass
        return Response(PurchaseOrderSerializer(po).data)

    # Categorised rejection reasons. Drives the auto-reissue downstream.
    REJECT_CATEGORIES = (
        'PRICE_HIGH',       # supplier quoted too high
        'NO_STOCK',         # supplier doesn't have stock
        'EXPIRY_TOO_SOON',  # batch expiry too close
        'DAMAGED',          # goods or packaging damaged
        'NEEDS_REVISION',   # PO needs editing — keep it pending, no reissue
        'OTHER',
    )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject (or send back) a PO with a structured category.

        Body:
            { reason: str, category?: 'PRICE_HIGH'|'NO_STOCK'|'EXPIRY_TOO_SOON'|'DAMAGED'|'NEEDS_REVISION'|'OTHER' }

        category=NEEDS_REVISION → PO is reverted to DRAFT (not REJECTED).
        Reviewer keeps editing the same PO; no auto-reissue fires.

        Any other category → status set to REJECTED. The downstream
        post_save signal will auto-create a new ProcurementRequest carrying
        the category + reason forward.
        """
        po = self.get_object()
        free_text = (request.data.get('reason') or '').strip()
        category = (request.data.get('category') or '').strip().upper()
        if category not in self.REJECT_CATEGORIES:
            category = 'OTHER'

        # Store as `[CATEGORY] free text` for downstream parsing.
        composed_reason = f"[{category}] {free_text}".strip()
        po.rejection_reason = composed_reason
        po.rejected_by = request.user if request.user and request.user.is_authenticated else None
        po.rejected_at = timezone.now()

        if category == 'NEEDS_REVISION':
            # Send back for editing — stays a draft PO, the same row.
            po.status = 'DRAFT'
            po.notes = f"{po.notes or ''}\nSent back for revision: {free_text}".strip()
            po.save(update_fields=['status', 'notes', 'rejection_reason', 'rejected_by', 'rejected_at'])
            return Response({
                **PurchaseOrderSerializer(po).data,
                '_reverted_to_draft': True,
                '_category': category,
            })

        # Real rejection — flip to REJECTED, signal handler will auto-reissue.
        po.status = 'REJECTED'
        po.notes = f"{po.notes or ''}\nRejected ({category}): {free_text}".strip()
        po.save(update_fields=['status', 'notes', 'rejection_reason', 'rejected_by', 'rejected_at'])
        return Response({
            **PurchaseOrderSerializer(po).data,
            '_category': category,
        })

    @action(detail=True, methods=['post'], url_path='send-to-supplier')
    def send_to_supplier(self, request, pk=None):
        """Mark PO as ordered / sent to supplier."""
        po = self.get_object()
        po.status = 'SENT'
        po.save(update_fields=['status'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='receive-line')
    def receive_line(self, request, pk=None):
        """Receive goods for a specific line and update inventory."""
        po = self.get_object()
        line_id = request.data.get('line_id')
        qty = Decimal(str(request.data.get('quantity', 0)))
        
        # Discrepancy parsing
        qty_damaged = Decimal(str(request.data.get('qty_damaged', 0)))
        qty_rejected = Decimal(str(request.data.get('qty_rejected', 0)))
        qty_missing = Decimal(str(request.data.get('qty_missing', 0)))
        receipt_notes = request.data.get('receipt_notes', '')
        
        # Gated import of StockService for cross-module loose coupling
        StockService = connector.require('inventory.services.get_stock_service', org_id=0, fallback=None, source='pos')
        if not StockService:
            return Response({"error": "Inventory module required for receiving"}, status=501)

        try:
            line = po.lines.get(id=line_id)
            
            # 1. Update Inventory Stock (only for accepted qty)
            warehouse = line.warehouse or po.warehouse
            if not warehouse:
                return Response({"error": "No warehouse defined for line or PO"}, status=400)

            if qty > 0:
                StockService.receive_stock(
                    organization=po.organization,
                    product=line.product,
                    warehouse=warehouse,
                    quantity=qty,
                    cost_price_ht=line.unit_price,
                    reference=f"PO-REC-{po.po_number or po.id}",
                    user=request.user
                )

            # 2. Record receiving and discrepancies on the PO line
            line.qty_damaged += qty_damaged
            line.qty_rejected += qty_rejected
            line.qty_missing += qty_missing
            if receipt_notes:
                line.receipt_notes = f"{line.receipt_notes}\n{receipt_notes}".strip() if line.receipt_notes else receipt_notes
            
            line.receive(qty) # This saves the model and triggers status checks

            # ── Auto-Task: check if product needs barcode ──
            try:
                if line.product and not line.product.barcode:
                    trigger_inv = connector.require('workspace.events.trigger_inventory', org_id=0, source='pos')
                    if trigger_inv:
                        trigger_inv(
                            org_id=po.organization_id, organization=po.organization, event='BARCODE_MISSING_PURCHASE',
                            product_name=str(line.product),
                            product_id=line.product_id,
                            amount=float(qty),
                            reference=po.po_number or f'PO-{po.pk}',
                            user=request.user,
                        )
            except Exception:
                pass

            # ── Auto-Task: if PO fully received, fire DELIVERY_COMPLETED ──
            try:
                po.refresh_from_db()
                if po.status == 'RECEIVED':
                    trigger_pur = connector.require('workspace.events.trigger_purchasing', org_id=0, source='pos')
                    if trigger_pur:
                        trigger_pur(
                            org_id=po.organization_id, organization=po.organization, event='DELIVERY_COMPLETED',
                            reference=po.po_number or f'PO-{po.pk}',
                            amount=float(po.total_amount or 0),
                            user=request.user,
                        )
                    # Also check for missing attachment
                    if not po.invoice and trigger_pur:
                        trigger_pur(
                            org_id=po.organization_id, organization=po.organization, event='PURCHASE_NO_ATTACHMENT',
                            reference=po.po_number or f'PO-{po.pk}',
                        )
            except Exception:
                pass

            return Response(PurchaseOrderSerializer(po).data)
        except PurchaseOrderLine.DoesNotExist:
            return Response({"error": "Line not found"}, status=404)
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": f"Internal Error: {str(e)}"}, status=500)

    @action(detail=True, methods=['post'], url_path='revert-to-draft')
    def revert_to_draft(self, request, pk=None):
        """Revert a PO back to DRAFT status."""
        po = self.get_object()
        if po.status not in ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'):
            return Response({"error": f"Cannot revert from {po.status}"}, status=400)
        reason = request.data.get('reason', '')
        if reason:
            po.notes = f"{po.notes or ''}\nReverted to draft: {reason}".strip()
        po.status = 'DRAFT'
        po.save(update_fields=['status', 'notes'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a PO."""
        po = self.get_object()
        po.status = 'CANCELLED'
        po.save(update_fields=['status'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='record-supplier-declaration')
    def record_supplier_declaration(self, request, pk=None):
        """Record supplier declared quantities from BL/Proforma."""
        po = self.get_object()
        declarations = request.data.get('lines', [])
        if not declarations:
            return Response({"error": "No line declarations provided"}, status=400)

        for decl in declarations:
            try:
                line = po.lines.get(id=decl['line_id'])
                line.supplier_declared_qty = Decimal(str(decl['declared_qty']))
                line.save(update_fields=['supplier_declared_qty'])
            except PurchaseOrderLine.DoesNotExist:
                return Response({"error": f"Line {decl.get('line_id')} not found"}, status=404)

        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='mark-invoiced')
    def mark_invoiced(self, request, pk=None):
        """Invoke PurchaseService to create an invoice and trigger 3-way matching."""
        from apps.pos.services.purchase_service import PurchaseService
        invoice_number = request.data.get('invoice_number')
        if not invoice_number:
            return Response({"error": "invoice_number is required"}, status=400)
            
        try:
            order = PurchaseService.invoice_po(
                organization=request.tenant_id,
                order_id=pk,
                invoice_number=invoice_number,
                user=request.user
            )
            return Response(PurchaseOrderSerializer(order).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)

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
            total=Sum('total_amount')
        )
        return Response(list(stats))


from rest_framework.exceptions import ValidationError

class PurchaseOrderLineViewSet(viewsets.ModelViewSet):
    """Direct CRUD for PO lines."""
    queryset = PurchaseOrderLine.objects.select_related('product', 'warehouse', 'order').all()
    serializer_class = PurchaseOrderLineSerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return self.queryset.filter(organization_id=org_id)

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        order = serializer.validated_data.get('order')
        if order and order.organization_id != org_id:
            raise ValidationError("Cross-tenant PO assignment blocked.")
        serializer.save(organization_id=org_id)

    def perform_update(self, serializer):
        org_id = get_current_tenant_id()
        order = serializer.validated_data.get('order')
        if order and order.organization_id != org_id:
            raise ValidationError("Cross-tenant PO assignment blocked.")
        serializer.save(organization_id=org_id)
