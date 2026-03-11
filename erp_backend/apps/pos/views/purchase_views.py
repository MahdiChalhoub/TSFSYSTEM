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
from apps.pos.services.base import _safe_import

class PurchaseViewSet(viewsets.ViewSet):
    """Handles Purchase Order (PO) operations."""
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        qs = Order.objects.filter(tenant_id=organization_id, type='PURCHASE').select_related('contact', 'user').order_by('-created_at')
        return Response(OrderSerializer(qs, many=True).data)

    def retrieve(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        try:
            order = Order.objects.select_related('contact', 'user', 'site').get(pk=pk, tenant_id=organization_id, type='PURCHASE')
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
            order = Order.objects.get(pk=pk, tenant_id=organization_id, type='PURCHASE')
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
        qs = self.queryset.filter(tenant_id=org_id, status='RECEIVED')
        return Response(PurchaseOrderSerializer(qs, many=True).data)

    def get_queryset(self):
        from django.db.models import Q
        org_id = get_current_tenant_id()
        qs = self.queryset.filter(tenant_id=org_id)

        # ── 1. Status & Type Filters ──
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)

        sub_type = self.request.query_params.get('purchase_sub_type')
        if sub_type and sub_type != 'ALL':
            qs = qs.filter(purchase_sub_type=sub_type)

        priority = self.request.query_params.get('priority')
        if priority and priority != 'ALL':
            qs = qs.filter(priority=priority)

        # ── 2. Entity & Location Filters ──
        supplier_id = self.request.query_params.get('supplier')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        warehouse_id = self.request.query_params.get('warehouse')
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)

        site_id = self.request.query_params.get('site')
        if site_id:
            qs = qs.filter(site_id=site_id)
        
        created_by = self.request.query_params.get('created_by')
        if created_by:
            qs = qs.filter(created_by_id=created_by)

        # ── 3. Date Range Filters (Created At) ──
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        # ── 4. Date Range Filters (Expected Delivery) ──
        expected_from = self.request.query_params.get('expected_from')
        expected_to = self.request.query_params.get('expected_to')
        if expected_from:
            qs = qs.filter(expected_date__gte=expected_from)
        if expected_to:
            qs = qs.filter(expected_date__lte=expected_to)

        # ── 5. Financial Filters ──
        min_amount = self.request.query_params.get('min_amount')
        max_amount = self.request.query_params.get('max_amount')
        if min_amount:
            qs = qs.filter(total_amount__gte=min_amount)
        if max_amount:
            qs = qs.filter(total_amount__lte=max_amount)

        # ── 6. Intelligent Text Search ──
        query = self.request.query_params.get('query', '').strip()
        if query:
            qs = qs.filter(
                Q(po_number__icontains=query) |
                Q(supplier__name__icontains=query) |
                Q(supplier_name__icontains=query) |
                Q(notes__icontains=query) |
                Q(supplier_ref__icontains=query)
            )

        return qs.distinct()

    def create(self, request, *args, **kwargs):
        """Override create to support nested line creation in a single POST."""
        import json
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=400)
        organization = Organization.objects.get(id=org_id)

        # Parse request data — handle both JSON and QueryDict
        try:
            data = json.loads(request.body) if hasattr(request.body, 'decode') else dict(request.data)
        except Exception:
            data = dict(request.data)

        lines_data = data.pop('lines', [])

        # Build PO header
        po = PurchaseOrder(
            organization=organization,
            supplier_id=data.get('supplier'),
            supplier_name=data.get('supplier_name', ''),
            site_id=data.get('site') or None,
            warehouse_id=data.get('warehouse') or None,
            status=data.get('status', 'DRAFT'),
            priority=data.get('priority', 'NORMAL'),
            purchase_sub_type=data.get('purchase_sub_type', 'STANDARD'),
            supplier_ref=data.get('supplier_ref', ''),
            expected_date=data.get('expected_date') or None,
            currency=data.get('currency', 'XOF'),
            shipping_cost=Decimal(str(data.get('shipping_cost', 0))),
            discount_amount=Decimal(str(data.get('discount_amount', 0))),
            notes=data.get('notes', ''),
            internal_notes=data.get('internal_notes', ''),
            invoice_policy=data.get('invoice_policy', 'RECEIVED_QTY'),
            payment_term_id=data.get('payment_term') or None,
            assigned_driver_id=data.get('assigned_driver') or None,
            created_by=request.user if request.user.is_authenticated else None,
        )
        po.save()

        # Create lines
        for idx, line_data in enumerate(lines_data):
            PurchaseOrderLine.objects.create(
                organization=organization,
                order=po,
                product_id=line_data.get('product') or line_data.get('product_id'),
                quantity=Decimal(str(line_data.get('quantity', 1))),
                unit_price=Decimal(str(line_data.get('unit_price', 0))),
                tax_rate=Decimal(str(line_data.get('tax_rate', 0))),
                discount_percent=Decimal(str(line_data.get('discount_percent', 0))),
                description=line_data.get('description', ''),
                sort_order=idx,
            )

        po.recalculate_totals()
        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)


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
    def submit(self, request, pk=None):
        """Submit PO for approval — resolves approval policy and fires event."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        po = self.get_object()
        if po.status != 'DRAFT':
            return Response({"error": f"Cannot submit PO in '{po.status}' status"}, status=400)

        # Resolve approval policy
        required_levels, policy = ProcurementDomainService.resolve_approval_policy(
            po.organization, po
        )

        po.status = 'SUBMITTED'
        po.submitted_by = request.user if request.user.is_authenticated else None
        po.submitted_at = timezone.now()
        po.save(update_fields=['status', 'submitted_by', 'submitted_at'])

        # Emit event via domain service
        ProcurementDomainService.emit_events(
            po.organization, 'PURCHASE_ENTERED',
            po_number=po.po_number or f'PO-{po.pk}',
            amount=float(po.total_amount or 0),
            site_id=po.site_id,
            required_approval_levels=required_levels,
        )

        data = PurchaseOrderSerializer(po).data
        data['approval_info'] = {
            'required_levels': required_levels,
            'policy_name': policy.name if policy else 'Default',
        }
        return Response(data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted PO — commits budget and fires event."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        po = self.get_object()
        if po.status != 'SUBMITTED':
            return Response({"error": f"Cannot approve PO in '{po.status}' status"}, status=400)

        # Budget check (advisory — does not block)
        is_ok, budget_warnings = ProcurementDomainService.check_budget(po.organization, po)

        po.status = 'APPROVED'
        po.approved_by = request.user if request.user.is_authenticated else None
        po.approved_at = timezone.now()
        po.save(update_fields=['status', 'approved_by', 'approved_at'])

        # Commit budget and emit events via domain service
        ProcurementDomainService._try_commit_budget(po)
        ProcurementDomainService.emit_events(
            po.organization, 'PO_APPROVED',
            po_number=po.po_number or f'PO-{po.pk}',
            amount=float(po.total_amount or 0),
        )

        data = PurchaseOrderSerializer(po).data
        if budget_warnings:
            data['budget_warnings'] = budget_warnings
        return Response(data)

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
        po.status = 'SENT'
        po.save(update_fields=['status'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='revert-to-draft')
    def revert_to_draft(self, request, pk=None):
        """Revert a PO back to DRAFT status.
        
        Allowed from: SUBMITTED, APPROVED, REJECTED, CANCELLED.
        Not allowed once goods have been sent to supplier or received.
        """
        po = self.get_object()
        revertable = ['SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED']
        if po.status not in revertable:
            return Response(
                {"error": f"Cannot revert from '{po.status}'. Only {', '.join(revertable)} POs can be reverted to Draft."},
                status=400
            )
        old_status = po.status
        po.status = 'DRAFT'
        po.approved_by = None
        reason = request.data.get('reason', '')
        note = f"\nReverted from {old_status} to DRAFT"
        if reason:
            note += f": {reason}"
        po.notes = f"{po.notes or ''}{note}".strip()
        po.save(update_fields=['status', 'approved_by', 'notes'])
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='receive-line')
    def receive_line(self, request, pk=None):
        """Receive goods via GoodsReceipt document — creates GRN, updates inventory, posts accrual."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        po = self.get_object()

        line_id = request.data.get('line_id')
        if not line_id:
            return Response({"error": "line_id is required"}, status=400)

        warehouse = po.warehouse
        if not warehouse:
            return Response({"error": "No warehouse defined for PO"}, status=400)

        try:
            grn = ProcurementDomainService.receive(
                organization=po.organization,
                po_id=po.id,
                lines=[{
                    'line_id': line_id,
                    'quantity': request.data.get('quantity', 0),
                    'qty_damaged': request.data.get('qty_damaged', 0),
                    'qty_rejected': request.data.get('qty_rejected', 0),
                    'qty_missing': request.data.get('qty_missing', 0),
                    'receipt_notes': request.data.get('receipt_notes', ''),
                    'expiry_date': request.data.get('expiry_date'),
                    'batch_number': request.data.get('batch_number'),
                }],
                warehouse_id=warehouse.id,
                user=request.user if request.user.is_authenticated else None,
                supplier_delivery_ref=request.data.get('supplier_delivery_ref', ''),
                scope=request.data.get('scope', 'OFFICIAL'),
            )
            po.refresh_from_db()
            data = PurchaseOrderSerializer(po).data
            data['goods_receipt_id'] = grn.id
            data['goods_receipt_number'] = grn.receipt_number
            return Response(data)
        except PurchaseOrderLine.DoesNotExist:
            return Response({"error": "Line not found"}, status=404)
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": f"Internal Error: {str(e)}"}, status=500)

    @action(detail=True, methods=['post'], url_path='create-receipt')
    def create_receipt(self, request, pk=None):
        """Create a multi-line GoodsReceipt from PO — supports bulk receiving."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        po = self.get_object()
        lines = request.data.get('lines', [])
        if not lines:
            return Response({"error": "At least one line is required"}, status=400)

        warehouse_id = request.data.get('warehouse_id') or (po.warehouse_id if po.warehouse else None)
        if not warehouse_id:
            return Response({"error": "warehouse_id is required"}, status=400)

        try:
            grn = ProcurementDomainService.receive(
                organization=po.organization,
                po_id=po.id,
                lines=lines,
                warehouse_id=warehouse_id,
                user=request.user if request.user.is_authenticated else None,
                supplier_delivery_ref=request.data.get('supplier_delivery_ref', ''),
                scope=request.data.get('scope', 'OFFICIAL'),
                notes=request.data.get('notes', ''),
            )
            po.refresh_from_db()
            data = PurchaseOrderSerializer(po).data
            data['goods_receipt_id'] = grn.id
            data['goods_receipt_number'] = grn.receipt_number
            return Response(data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": f"Internal Error: {str(e)}"}, status=500)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a PO — releases budget commitments and fires event."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        po = self.get_object()
        terminal = ('COMPLETED', 'CANCELLED')
        if po.status in terminal:
            return Response({"error": f"Cannot cancel PO in '{po.status}' status"}, status=400)

        reason = request.data.get('reason', '')
        po.status = 'CANCELLED'
        po.cancelled_by = request.user if request.user.is_authenticated else None
        po.cancelled_at = timezone.now()
        po.cancellation_reason = reason
        po.save(update_fields=['status', 'cancelled_by', 'cancelled_at', 'cancellation_reason'])

        # Release budget and emit event
        ProcurementDomainService._try_release_budget(po)
        ProcurementDomainService.emit_events(
            po.organization, 'PO_CANCELLED',
            po_number=po.po_number or f'PO-{po.pk}',
            reason=reason,
        )
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
        """Create invoice + persist 3-way match results via ProcurementDomainService."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        invoice_number = request.data.get('invoice_number')
        if not invoice_number:
            return Response({"error": "invoice_number is required"}, status=400)

        try:
            invoice, match_result = ProcurementDomainService.invoice(
                organization=request.tenant_id,
                po_id=pk,
                invoice_data={'invoice_number': invoice_number},
                user=request.user if request.user.is_authenticated else None,
            )
            po = self.get_object()
            data = PurchaseOrderSerializer(po).data
            data['match_result'] = {
                'id': match_result.id,
                'status': match_result.status,
                'payment_blocked': match_result.payment_blocked,
                'violations': match_result.violations,
            }
            return Response(data)
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

    @action(detail=True, methods=['get'], url_path='budget-check')
    def budget_check(self, request, pk=None):
        """Validate budget availability for this PO."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        po = self.get_object()
        is_ok, warnings = ProcurementDomainService.check_budget(po.organization, po)
        return Response({
            'is_ok': is_ok,
            'warnings': warnings,
            'po_amount': float(po.total_amount or 0),
        })

    @action(detail=True, methods=['get'], url_path='match-summary')
    def match_summary(self, request, pk=None):
        """Return 3-way match status summary for UI display."""
        from apps.pos.models.procurement_governance_models import ThreeWayMatchResult
        from apps.pos.serializers.procurement_governance_serializers import ThreeWayMatchResultSerializer
        po = self.get_object()
        results = ThreeWayMatchResult.objects.filter(
            purchase_order=po
        ).select_related('invoice', 'matched_by').order_by('-matched_at')

        return Response({
            'po_id': po.id,
            'po_number': po.po_number,
            'match_count': results.count(),
            'has_disputes': results.filter(status='DISPUTED').exists(),
            'has_blocked': results.filter(payment_blocked=True).exists(),
            'results': ThreeWayMatchResultSerializer(results, many=True).data,
        })

    @action(detail=True, methods=['get'], url_path='approval-status')
    def approval_status(self, request, pk=None):
        """Show approval policy requirements and current status."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        po = self.get_object()
        required_levels, policy = ProcurementDomainService.resolve_approval_policy(
            po.organization, po
        )
        return Response({
            'po_id': po.id,
            'po_status': po.status,
            'required_levels': required_levels,
            'policy_name': policy.name if policy else 'Default',
            'approved_by': str(po.approved_by) if po.approved_by else None,
            'approved_at': str(po.approved_at) if po.approved_at else None,
            'submitted_by': str(po.submitted_by) if po.submitted_by else None,
            'submitted_at': str(po.submitted_at) if po.submitted_at else None,
        })

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """PO dashboard stats."""
        org_id = get_current_tenant_id()
        from django.db.models import Count, Sum
        stats = PurchaseOrder.objects.filter(tenant_id=org_id).values('status').annotate(
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
        return self.queryset.filter(tenant_id=org_id)

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        order = serializer.validated_data.get('order')
        if order and order.organization_id != org_id:
            raise ValidationError("Cross-tenant PO assignment blocked.")
        serializer.save(tenant_id=org_id)

    def perform_update(self, serializer):
        org_id = get_current_tenant_id()
        order = serializer.validated_data.get('order')
        if order and order.organization_id != org_id:
            raise ValidationError("Cross-tenant PO assignment blocked.")
        serializer.save(tenant_id=org_id)


# ═══════════════════════════════════════════════════════════════════
# PROCUREMENT REQUEST VIEWSET
# ═══════════════════════════════════════════════════════════════════

from apps.pos.models import ProcurementRequest
from rest_framework import serializers as drf_serializers


class ProcurementRequestSerializer(drf_serializers.ModelSerializer):
    product_name = drf_serializers.CharField(source='product.name', read_only=True)
    supplier_name = drf_serializers.CharField(source='supplier.name', read_only=True, default='')
    from_warehouse_name = drf_serializers.CharField(source='from_warehouse.name', read_only=True, default='')
    to_warehouse_name = drf_serializers.CharField(source='to_warehouse.name', read_only=True, default='')
    requested_by_name = drf_serializers.CharField(source='requested_by.get_full_name', read_only=True, default='')

    class Meta:
        model = ProcurementRequest
        fields = '__all__'
        read_only_fields = ['organization', 'requested_by', 'reviewed_by', 'reviewed_at']


class ProcurementRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementRequestSerializer
    queryset = ProcurementRequest.objects.all()

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return ProcurementRequest.objects.none()
        qs = ProcurementRequest.objects.filter(tenant_id=org_id).select_related(
            'product', 'supplier', 'from_warehouse', 'to_warehouse', 'requested_by'
        ).order_by('-requested_at')

        req_type = self.request.query_params.get('type')
        if req_type:
            qs = qs.filter(request_type=req_type)
        req_status = self.request.query_params.get('status')
        if req_status:
            qs = qs.filter(status=req_status)
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        serializer.save(
            tenant_id=org_id,
            requested_by=self.request.user if self.request.user.is_authenticated else None
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        obj = self.get_object()
        if obj.status != 'PENDING':
            return Response({'error': f'Cannot approve request in {obj.status} status'}, status=400)
        from django.utils import timezone
        obj.status = 'APPROVED'
        obj.reviewed_by = request.user if request.user.is_authenticated else None
        obj.reviewed_at = timezone.now()
        obj.save()
        return Response(ProcurementRequestSerializer(obj).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        obj = self.get_object()
        if obj.status != 'PENDING':
            return Response({'error': f'Cannot reject request in {obj.status} status'}, status=400)
        from django.utils import timezone
        obj.status = 'REJECTED'
        obj.reviewed_by = request.user if request.user.is_authenticated else None
        obj.reviewed_at = timezone.now()
        obj.notes = request.data.get('reason', obj.notes)
        obj.save()
        return Response(ProcurementRequestSerializer(obj).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        obj = self.get_object()
        if obj.status in ('EXECUTED', 'CANCELLED'):
            return Response({'error': f'Cannot cancel request in {obj.status} status'}, status=400)
        obj.status = 'CANCELLED'
        obj.save()
        return Response(ProcurementRequestSerializer(obj).data)
