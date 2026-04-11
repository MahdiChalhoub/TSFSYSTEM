"""
Invoice Verification Views
===========================
API endpoints for 3-way matching and invoice verification workflow.

Endpoints:
  - GET /api/pos/invoice-verification/pending/  — List all invoices pending verification
  - GET /api/pos/invoice-verification/{id}/     — Get invoice with PO and GRN data
  - POST /api/pos/invoice-verification/{id}/verify/ — Approve invoice
  - POST /api/pos/invoice-verification/{id}/reject/ — Reject invoice
  - POST /api/pos/invoice-verification/{id}/hold/   — Put on hold
  - POST /api/pos/invoice-verification/{id}/upload-document/ — Attach scanned invoice
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from apps.finance.models import Invoice, InvoiceLine
from apps.pos.models import PurchaseOrder, PurchaseOrderLine
from apps.inventory.models import GoodsReceipt, GoodsReceiptLine
from apps.pos.services.three_way_match_service import ThreeWayMatchService
from erp.middleware import get_current_tenant_id
from erp.models import Organization, User


class InvoiceVerificationViewSet(viewsets.ViewSet):
    """
    Invoice verification and 3-way matching workflow.
    """

    def list(self, request):
        """
        GET /api/pos/invoice-verification/pending/
        Returns all purchase invoices pending verification.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        # Filter invoices that need verification
        invoices = Invoice.objects.filter(
            organization_id=organization_id,
            type='PURCHASE',
            status__in=['DRAFT', 'PENDING', 'DISPUTED']
        ).select_related(
            'contact', 'source_order', 'site'
        ).prefetch_related(
            'lines__product'
        ).order_by('-issue_date', '-created_at')

        # Serialize with 3-way match data
        data = []
        for invoice in invoices:
            # Get linked PO
            po = None
            if invoice.source_order:
                try:
                    po = PurchaseOrder.objects.get(
                        organization_id=organization_id,
                        order_ptr_id=invoice.source_order_id
                    )
                except PurchaseOrder.DoesNotExist:
                    pass

            # Get GRN data
            grn_data = None
            if po:
                try:
                    grn = GoodsReceipt.objects.filter(
                        organization_id=organization_id,
                        purchase_order=po
                    ).first()
                    if grn:
                        grn_data = {
                            'id': grn.id,
                            'grn_number': grn.grn_number,
                            'receipt_date': grn.receipt_date,
                            'status': grn.status,
                        }
                except:
                    pass

            invoice_data = {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'type': invoice.type,
                'status': invoice.status,
                'supplier_id': invoice.contact_id,
                'supplier_name': invoice.contact_name or invoice.contact.name,
                'issue_date': invoice.issue_date,
                'due_date': invoice.due_date,
                'subtotal': float(invoice.subtotal_ht),
                'tax_amount': float(invoice.tax_amount),
                'total_amount': float(invoice.total_amount),
                'currency': invoice.currency,
                'payment_blocked': invoice.payment_blocked,
                'dispute_reason': invoice.dispute_reason,
                'disputed_lines_count': invoice.disputed_lines_count,
                'disputed_amount_delta': float(invoice.disputed_amount_delta),

                # PO data
                'po_number': po.po_number if po else None,
                'po_total': float(po.total_amount) if po else None,
                'po_status': po.status if po else None,

                # GRN data
                'grn_number': grn_data['grn_number'] if grn_data else None,
                'grn_date': grn_data['receipt_date'] if grn_data else None,
                'grn_status': grn_data['status'] if grn_data else None,

                # Document
                'document_url': getattr(invoice, 'document_url', None),
                'has_document': bool(getattr(invoice, 'document_url', None)),

                # Line items count
                'line_count': invoice.lines.count(),
            }
            data.append(invoice_data)

        return Response({
            'count': len(data),
            'invoices': data
        })

    def retrieve(self, request, pk=None):
        """
        GET /api/pos/invoice-verification/{id}/
        Returns detailed invoice with PO and GRN comparison data.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = Invoice.objects.select_related(
                'contact', 'source_order', 'site'
            ).prefetch_related(
                'lines__product', 'lines__tax_account'
            ).get(
                pk=pk,
                organization_id=organization_id,
                type='PURCHASE'
            )
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get linked PO
        po = None
        po_lines = []
        if invoice.source_order:
            try:
                po = PurchaseOrder.objects.get(
                    organization_id=organization_id,
                    order_ptr_id=invoice.source_order_id
                )
                po_lines = PurchaseOrderLine.objects.filter(
                    order=po
                ).select_related('product')
            except PurchaseOrder.DoesNotExist:
                pass

        # Get GRN data
        grn = None
        grn_lines = []
        if po:
            try:
                grn = GoodsReceipt.objects.filter(
                    organization_id=organization_id,
                    purchase_order=po
                ).first()
                if grn:
                    grn_lines = GoodsReceiptLine.objects.filter(
                        goods_receipt=grn
                    ).select_related('product')
            except:
                pass

        # Build 3-way comparison
        comparison_lines = []
        for inv_line in invoice.lines.all():
            product_id = inv_line.product_id

            # Find matching PO line
            po_line = next((pl for pl in po_lines if pl.product_id == product_id), None)

            # Find matching GRN line
            grn_line = next((gl for gl in grn_lines if gl.product_id == product_id), None)

            comparison_lines.append({
                'product_id': product_id,
                'product_name': inv_line.product.name if inv_line.product else inv_line.description,
                'invoice': {
                    'quantity': float(inv_line.quantity),
                    'unit_price': float(inv_line.unit_price),
                    'subtotal': float(inv_line.subtotal_ht),
                    'tax': float(inv_line.tax_amount),
                    'total': float(inv_line.total_ttc),
                },
                'po': {
                    'quantity': float(po_line.quantity) if po_line else None,
                    'unit_price': float(po_line.unit_price) if po_line else None,
                    'subtotal': float(po_line.subtotal) if po_line else None,
                } if po_line else None,
                'grn': {
                    'quantity': float(grn_line.quantity_received) if grn_line else None,
                    'date': grn_line.goods_receipt.receipt_date if grn_line else None,
                } if grn_line else None,
                'match_status': self._get_match_status(inv_line, po_line, grn_line),
            })

        response_data = {
            'invoice': {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'status': invoice.status,
                'supplier_name': invoice.contact_name or invoice.contact.name,
                'supplier_id': invoice.contact_id,
                'issue_date': invoice.issue_date,
                'due_date': invoice.due_date,
                'subtotal': float(invoice.subtotal_ht),
                'tax_amount': float(invoice.tax_amount),
                'total_amount': float(invoice.total_amount),
                'currency': invoice.currency,
                'payment_blocked': invoice.payment_blocked,
                'dispute_reason': invoice.dispute_reason,
                'document_url': getattr(invoice, 'document_url', None),
            },
            'purchase_order': {
                'po_number': po.po_number if po else None,
                'status': po.status if po else None,
                'order_date': po.order_date if po else None,
                'expected_date': po.expected_date if po else None,
                'subtotal': float(po.subtotal) if po else None,
                'tax_amount': float(po.tax_amount) if po else None,
                'total_amount': float(po.total_amount) if po else None,
            } if po else None,
            'goods_receipt': {
                'grn_number': grn.grn_number if grn else None,
                'receipt_date': grn.receipt_date if grn else None,
                'status': grn.status if grn else None,
                'received_by': grn.received_by.get_full_name() if grn and grn.received_by else None,
            } if grn else None,
            'comparison': comparison_lines,
            'can_verify': invoice.status in ['DRAFT', 'PENDING'],
            'can_reject': invoice.status in ['DRAFT', 'PENDING', 'DISPUTED'],
        }

        return Response(response_data)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """
        POST /api/pos/invoice-verification/{id}/verify/
        Run 3-way match and approve invoice if valid.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = Invoice.objects.get(
                pk=pk,
                organization_id=organization_id,
                type='PURCHASE'
            )
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status not in ['DRAFT', 'PENDING', 'DISPUTED']:
            return Response({
                "error": f"Cannot verify invoice in status: {invoice.status}"
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Run 3-way match validation
            is_valid, violations = ThreeWayMatchService.validate_invoice(invoice)

            if not is_valid:
                return Response({
                    "success": False,
                    "message": "3-way match failed",
                    "violations": violations,
                    "invoice_status": invoice.status,
                    "payment_blocked": invoice.payment_blocked,
                }, status=status.HTTP_400_BAD_REQUEST)

            # Approve invoice
            invoice.status = 'VERIFIED'
            invoice.payment_blocked = False
            invoice.dispute_reason = None
            invoice.verified_by = request.user if request.user.is_authenticated else None
            invoice.verified_at = timezone.now()
            invoice.save(update_fields=[
                'status', 'payment_blocked', 'dispute_reason',
                'verified_by', 'verified_at'
            ])

            return Response({
                "success": True,
                "message": "Invoice verified successfully",
                "invoice_status": invoice.status,
                "verified_at": invoice.verified_at,
            })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        POST /api/pos/invoice-verification/{id}/reject/
        Reject invoice with reason.

        Body: { "reason": "..." }
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = Invoice.objects.get(
                pk=pk,
                organization_id=organization_id,
                type='PURCHASE'
            )
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', '')
        if not reason:
            return Response({
                "error": "Rejection reason is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            invoice.status = 'REJECTED'
            invoice.payment_blocked = True
            invoice.dispute_reason = reason
            invoice.rejected_by = request.user if request.user.is_authenticated else None
            invoice.rejected_at = timezone.now()
            invoice.save(update_fields=[
                'status', 'payment_blocked', 'dispute_reason',
                'rejected_by', 'rejected_at'
            ])

            return Response({
                "success": True,
                "message": "Invoice rejected",
                "invoice_status": invoice.status,
                "rejected_at": invoice.rejected_at,
            })

    @action(detail=True, methods=['post'])
    def hold(self, request, pk=None):
        """
        POST /api/pos/invoice-verification/{id}/hold/
        Put invoice on hold pending clarification.

        Body: { "reason": "..." }
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = Invoice.objects.get(
                pk=pk,
                organization_id=organization_id,
                type='PURCHASE'
            )
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', 'On hold for review')

        with transaction.atomic():
            invoice.status = 'ON_HOLD'
            invoice.payment_blocked = True
            invoice.dispute_reason = reason
            invoice.save(update_fields=[
                'status', 'payment_blocked', 'dispute_reason'
            ])

            return Response({
                "success": True,
                "message": "Invoice put on hold",
                "invoice_status": invoice.status,
            })

    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        """
        POST /api/pos/invoice-verification/{id}/upload-document/
        Upload scanned invoice document.

        Expects multipart/form-data with 'document' file field.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = Invoice.objects.get(
                pk=pk,
                organization_id=organization_id,
                type='PURCHASE'
            )
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

        if 'document' not in request.FILES:
            return Response({
                "error": "No document file provided"
            }, status=status.HTTP_400_BAD_REQUEST)

        document_file = request.FILES['document']

        # TODO: Upload to cloud storage (S3, Azure, etc.)
        # For now, save locally or return placeholder

        # Placeholder implementation
        document_url = f"/media/invoices/{invoice.id}/{document_file.name}"

        invoice.document_url = document_url
        invoice.save(update_fields=['document_url'])

        return Response({
            "success": True,
            "message": "Document uploaded successfully",
            "document_url": document_url,
        })

    def _get_match_status(self, inv_line, po_line, grn_line):
        """
        Determine if line items match across invoice, PO, and GRN.
        Returns: 'MATCH', 'MISMATCH', 'PARTIAL', 'MISSING_PO', 'MISSING_GRN'
        """
        if not po_line:
            return 'MISSING_PO'

        if not grn_line:
            return 'MISSING_GRN'

        # Check quantity match
        inv_qty = inv_line.quantity
        po_qty = po_line.quantity
        grn_qty = grn_line.quantity_received

        # Check price match (with tolerance)
        inv_price = inv_line.unit_price
        po_price = po_line.unit_price
        price_tolerance = Decimal('0.01')

        qty_match = (inv_qty == grn_qty)
        price_match = abs(inv_price - po_price) <= price_tolerance

        if qty_match and price_match:
            return 'MATCH'
        elif not qty_match and not price_match:
            return 'MISMATCH'
        else:
            return 'PARTIAL'
