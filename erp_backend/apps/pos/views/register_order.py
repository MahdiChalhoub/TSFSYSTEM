"""
POS Register management views.
Handles register CRUD, session open/close, PIN authentication, and lobby data.
"""
from .base import (
    viewsets, status, Response, action, get_current_tenant_id,
    Organization, User, Warehouse, timezone
)
from django.db.models import Sum, Count, Q
from decimal import Decimal

from apps.pos.models import POSRegister, RegisterSession, Order, CashierAddressBook
from apps.pos.models.register_models import SessionAccountReconciliation



class RegisterOrderMixin:

    @action(detail=False, methods=['post'], url_path='process-return')
    def process_return(self, request):
        """
        Process a return/refund on a completed order.
        Expects: { order_ref: "INV-001", items: [{product_id, quantity, unit_price}], reason?: str }
        Returns negative RETURN order with reversed inventory.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)

        order_ref = request.data.get('order_ref', '').strip()
        return_items = request.data.get('items', [])
        reason = request.data.get('reason', '')

        if not order_ref:
            return Response({"error": "order_ref is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not return_items:
            return Response({"error": "items list is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Find original order
        try:
            original = Order.objects.select_related('user', 'site').get(
                organization=organization,
                invoice_number=order_ref,
                type='SALE',
                status='COMPLETED',
            )
        except Order.DoesNotExist:
            return Response({"error": f"Order '{order_ref}' not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check not already fully returned
        already_returned = Order.objects.filter(
            organization=organization,
            return_for=original,
            type='RETURN',
            status='COMPLETED',
        ).aggregate(ret_count=Count('id'))
        # (Allow partial returns — no blocking here, just info)

        from apps.inventory.models import Product, Inventory
        from decimal import Decimal as D

        with transaction.atomic():
            # Gapless return sequence
            try:
                from apps.finance.services import SequenceService, LedgerService
                ret_num = SequenceService.get_next_number(organization, 'RETURN_OFFICIAL')
            except Exception:
                import random
                ret_num = f"RET-{random.randint(10000, 99999)}"

            total_return = D('0')
            return_order = Order.objects.create(
                organization=organization,
                user=request.user if not request.user.is_anonymous else original.user,
                site=original.site,
                type='RETURN',
                status='COMPLETED',
                invoice_number=ret_num,
                payment_method=original.payment_method,
                notes=f"Return: {reason}" if reason else "Return",
                return_for=original if hasattr(Order, 'return_for') else None,
            )

            for ri in return_items:
                try:
                    product = Product.objects.get(id=ri['product_id'], organization=organization)
                except Product.DoesNotExist:
                    continue
                qty = D(str(ri.get('quantity', 1)))
                price = D(str(ri.get('unit_price', product.price or 0)))
                line_total = qty * price
                total_return += line_total

                from apps.pos.models import OrderLine
                OrderLine.objects.create(
                    organization=organization,
                    order=return_order,
                    product=product,
                    quantity=qty,
                    unit_price=price,
                    total_price=line_total,
                )

                # Restore inventory
                try:
                    inv = Inventory.objects.filter(
                        organization=organization,
                        product=product,
                        warehouse=original.site,
                    ).first()
                    if inv:
                        inv.quantity += qty
                        inv.save(update_fields=['quantity'])
                except Exception:
                    pass

            return_order.total_amount = total_return
            return_order.save(update_fields=['total_amount'])

        return Response({
            'message': f'Return processed — {ret_num}',
            'return_id': return_order.id,
            'return_ref': ret_num,
            'total_returned': float(total_return),
            'original_ref': order_ref,
        }, status=status.HTTP_201_CREATED)


    @action(detail=False, methods=['get'], url_path='lookup-order')
    def lookup_order(self, request):
        """
        Look up an order by invoice number for return processing.
        Returns order details including line items.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        ref = request.query_params.get('ref', '').strip()
        if not ref:
            return Response({"error": "ref is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.select_related('user', 'site').prefetch_related('lines__product').get(
                tenant_id=org_id,
                invoice_number__iexact=ref,
                type='SALE',
                status='COMPLETED',
            )
        except Order.DoesNotExist:
            return Response({"error": f"Order '{ref}' not found"}, status=status.HTTP_404_NOT_FOUND)

        lines = []
        for line in order.lines.all():
            lines.append({
                'productId': line.product_id,
                'productName': line.product.name if line.product else '—',
                'quantity': float(line.quantity),
                'unitPrice': float(line.unit_price),
                'totalPrice': float(line.total_price),
            })

        return Response({
            'id': order.id,
            'ref': order.invoice_number,
            'date': order.created_at.isoformat() if order.created_at else None,
            'cashierName': f"{order.user.first_name} {order.user.last_name}".strip() if order.user else '',
            'totalAmount': float(order.total_amount or 0),
            'paymentMethod': order.payment_method,
            'lines': lines,
        })

    # ── Gap 10B: Async PDF Invoice Generation ──────────────────────────────────

    @action(detail=True, methods=['post'], url_path='generate-invoice')
    def generate_invoice(self, request, pk=None):
        """
        Dispatch a Celery task to generate a PDF invoice for this order.
        Returns immediately with { doc_id, task_id, status: 'PENDING' }.
        Poll `invoice-status` for completion.
        """
        from apps.pos.models import GeneratedDocument
        from apps.pos.tasks_invoice import generate_invoice_pdf

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'No org context'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.get(id=pk, tenant_id=org_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

        doc_type = request.data.get('doc_type', 'INVOICE')
        if doc_type not in ('INVOICE', 'RECEIPT'):
            doc_type = 'INVOICE'

        # Create a PENDING record first so the caller gets an ID immediately
        doc = GeneratedDocument.objects.create(
            tenant_id=org_id,
            order_id=order.id,
            doc_type=doc_type,
            status='PENDING',
        )

        # Dispatch async task
        task = generate_invoice_pdf.delay(doc.id)
        doc.task_id = task.id
        doc.save(update_fields=['task_id'])

        return Response({
            'doc_id':  doc.id,
            'task_id': task.id,
            'status':  'PENDING',
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'], url_path='invoice-status')
    def invoice_status(self, request, pk=None):
        """
        Poll the status of a PDF generation job for this order.
        Returns { status, pdf_url } when READY, or { status, error } if FAILED.
        """
        from apps.pos.models import GeneratedDocument
        from django.conf import settings as django_settings

        org_id = get_current_tenant_id()
        doc_type = request.query_params.get('doc_type', 'INVOICE')

        try:
            doc = GeneratedDocument.objects.filter(
                tenant_id=org_id,
                order_id=pk,
                doc_type=doc_type,
            ).latest('generated_at')
        except GeneratedDocument.DoesNotExist:
            return Response({'status': 'NOT_FOUND'}, status=status.HTTP_404_NOT_FOUND)

        response: dict = {
            'doc_id': doc.id,
            'status': doc.status,
        }

        if doc.status == 'READY' and doc.file_path:
            media_url = getattr(django_settings, 'MEDIA_URL', '/media/')
            response['pdf_url'] = f"{media_url}{doc.file_path}"
        elif doc.status == 'FAILED':
            response['error'] = doc.error_msg or 'Unknown error'

        return Response(response)

