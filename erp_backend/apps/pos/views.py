"""
POS Module Views
ViewSets for Point of Sale and Purchase Order operations.
"""
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.middleware import get_current_tenant_id
from erp.models import Organization

# Gated cross-module imports
try:
    from apps.inventory.models import Warehouse
except ImportError:
    Warehouse = None

from apps.pos.models import Order
from apps.pos.services import POSService, PurchaseService
from apps.pos.returns_models import SalesReturn, CreditNote, PurchaseReturn
from apps.pos.returns_service import ReturnsService
from apps.pos.serializers import (
    OrderSerializer, QuotationSerializer,
    DeliveryZoneSerializer, DeliveryOrderSerializer,
    DiscountRuleSerializer, DiscountUsageLogSerializer,
    SalesReturnSerializer, CreditNoteSerializer, PurchaseReturnSerializer
)
from erp.views import TenantModelViewSet
try:
    from apps.pos.pdf_service import PDFService
except ImportError:
    PDFService = None  # xhtml2pdf not installed — PDF generation disabled
from django.http import HttpResponse


class POSViewSet(viewsets.ViewSet):
    """Handles Point of Sale transactions."""
    @action(detail=False, methods=['post'])
    def checkout(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            warehouse_id = request.data.get('warehouse_id')
            payment_account_id = request.data.get('payment_account_id')
            items = request.data.get('items')
            scope = request.data.get('scope', 'OFFICIAL')
            user = request.user
            if user.is_anonymous:
                from erp.models import User
                user = User.objects.filter(organization=organization, is_staff=True).first()
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
            order = POSService.checkout(
                organization=organization, user=user, warehouse=warehouse,
                payment_account_id=payment_account_id, items=items, scope=scope
            )
            return Response({
                "message": "Checkout successful",
                "order_id": order.id,
                "ref": order.invoice_number,
                "total_amount": float(order.total_amount)
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback; traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='daily-summary')
    def daily_summary(self, request):
        """Daily cash register summary with payment breakdown."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)

        from django.db.models import Sum, Count, Q
        from django.utils import timezone
        from datetime import timedelta

        # Date range: default today, support ?date=YYYY-MM-DD and ?days=7
        date_str = request.query_params.get('date')
        days = int(request.query_params.get('days', '1'))

        if date_str:
            from datetime import datetime
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            start = timezone.make_aware(datetime.combine(target_date, datetime.min.time()))
            end = timezone.make_aware(datetime.combine(target_date, datetime.max.time()))
        else:
            end = timezone.now()
            start = end - timedelta(days=days)

        orders = Order.objects.filter(
            organization=organization,
            created_at__gte=start,
            created_at__lte=end,
        )

        # Overall stats
        sales = orders.filter(type='SALE').aggregate(
            count=Count('id'), total=Sum('total_amount'), tax=Sum('tax_amount'), discount=Sum('discount')
        )
        purchases = orders.filter(type='PURCHASE').aggregate(
            count=Count('id'), total=Sum('total_amount')
        )
        returns = orders.filter(type='RETURN').aggregate(
            count=Count('id'), total=Sum('total_amount')
        )

        # Payment method breakdown (for sales)
        payment_methods = {}
        for order in orders.filter(type='SALE'):
            method = order.payment_method or 'CASH'
            if method not in payment_methods:
                payment_methods[method] = {'count': 0, 'total': 0}
            payment_methods[method]['count'] += 1
            payment_methods[method]['total'] += float(order.total_amount)

        # Per-user breakdown
        user_stats = {}
        for order in orders.filter(type='SALE'):
            user_name = f"{order.user.first_name} {order.user.last_name}".strip() if order.user else 'System'
            if not user_name:
                user_name = order.user.username if order.user else 'System'
            if user_name not in user_stats:
                user_stats[user_name] = {'count': 0, 'total': 0}
            user_stats[user_name]['count'] += 1
            user_stats[user_name]['total'] += float(order.total_amount)

        # Hourly distribution (for sales)
        hourly = [0] * 24
        for order in orders.filter(type='SALE'):
            if order.created_at:
                h = order.created_at.hour
                hourly[h] += float(order.total_amount)

        # Recent transactions
        recent = [{
            'id': o.id,
            'ref_code': o.ref_code,
            'type': o.type,
            'status': o.status,
            'total': float(o.total_amount),
            'payment_method': o.payment_method,
            'user': f"{o.user.first_name} {o.user.last_name}".strip() if o.user else 'System',
            'time': str(o.created_at) if o.created_at else None,
        } for o in orders.order_by('-created_at')[:20]]

        net_revenue = float(sales['total'] or 0) - float(returns['total'] or 0)

        return Response({
            'period': {'start': str(start), 'end': str(end)},
            'sales': {
                'count': sales['count'] or 0,
                'total': float(sales['total'] or 0),
                'tax': float(sales['tax'] or 0),
                'discount': float(sales['discount'] or 0),
            },
            'purchases': {
                'count': purchases['count'] or 0,
                'total': float(purchases['total'] or 0),
            },
            'returns': {
                'count': returns['count'] or 0,
                'total': float(returns['total'] or 0),
            },
            'net_revenue': net_revenue,
            'payment_methods': payment_methods,
            'user_stats': user_stats,
            'hourly': hourly,
            'recent': recent,
        })

    @action(detail=True, methods=['get'], url_path='invoice-pdf')
    def invoice_pdf(self, request, pk=None):
        """Generates and serves a professional PDF invoice for an order."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=400)
            
        try:
            order = Order.objects.select_related('organization', 'contact').get(
                id=pk, organization_id=organization_id
            )
            
            if PDFService is None:
                return Response({"error": "PDF generation not available (xhtml2pdf not installed)"}, status=501)
            context = PDFService.get_invoice_context(order)
            pdf_content = PDFService.render_to_pdf('pos/invoice.html', context)
            
            if not pdf_content:
                return Response({"error": "Failed to generate PDF"}, status=500)
                
            response = HttpResponse(pdf_content, content_type='application/pdf')
            filename = f"Invoice_{order.invoice_number or order.id}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
            
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['get'], url_path='sales-analytics')
    def sales_analytics(self, request):
        """Sales analytics: top products, customer segments, daily trend."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)

        from django.db.models import Sum, Count, Avg, F
        from django.utils import timezone
        from datetime import timedelta
        from apps.pos.models import OrderLine

        days = int(request.query_params.get('days', '30'))
        end = timezone.now()
        start = end - timedelta(days=days)

        sales = Order.objects.filter(
            organization=organization, type='SALE',
            created_at__gte=start, created_at__lte=end,
        )

        # Top products by revenue
        top_products = (
            OrderLine.objects.filter(order__in=sales)
            .values('product__name')
            .annotate(
                total_revenue=Sum('total'),
                total_qty=Sum('quantity'),
                avg_price=Avg('unit_price'),
            )
            .order_by('-total_revenue')[:10]
        )

        # Customer breakdown (top customers)
        top_customers = (
            sales.filter(contact__isnull=False)
            .values('contact__name')
            .annotate(
                order_count=Count('id'),
                total_spent=Sum('total_amount'),
            )
            .order_by('-total_spent')[:10]
        )

        # Daily trend
        from django.db.models.functions import TruncDate
        daily_trend = (
            sales.annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(revenue=Sum('total_amount'), count=Count('id'))
            .order_by('day')
        )

        # Payment method distribution
        payment_dist = (
            sales.values('payment_method')
            .annotate(count=Count('id'), total=Sum('total_amount'))
            .order_by('-total')
        )

        # Site performance
        site_perf = (
            sales.filter(site__isnull=False)
            .values('site__name')
            .annotate(count=Count('id'), total=Sum('total_amount'))
            .order_by('-total')
        )

        # Overall stats for the period
        overall = sales.aggregate(
            total_revenue=Sum('total_amount'),
            total_tax=Sum('tax_amount'),
            total_discount=Sum('discount'),
            order_count=Count('id'),
            avg_order=Avg('total_amount'),
        )

        return Response({
            'period': {'days': days, 'start': str(start.date()), 'end': str(end.date())},
            'overall': {
                'revenue': float(overall['total_revenue'] or 0),
                'tax': float(overall['total_tax'] or 0),
                'discount': float(overall['total_discount'] or 0),
                'orders': overall['order_count'] or 0,
                'avg_order': float(overall['avg_order'] or 0),
            },
            'top_products': [
                {'name': p['product__name'], 'revenue': float(p['total_revenue'] or 0),
                 'qty': float(p['total_qty'] or 0), 'avg_price': float(p['avg_price'] or 0)}
                for p in top_products
            ],
            'top_customers': [
                {'name': c['contact__name'], 'orders': c['order_count'],
                 'spent': float(c['total_spent'] or 0)}
                for c in top_customers
            ],
            'daily_trend': [
                {'date': str(d['day']), 'revenue': float(d['revenue'] or 0), 'count': d['count']}
                for d in daily_trend
            ],
            'payment_methods': [
                {'method': p['payment_method'], 'count': p['count'], 'total': float(p['total'] or 0)}
                for p in payment_dist
            ],
            'site_performance': [
                {'site': s['site__name'], 'count': s['count'], 'total': float(s['total'] or 0)}
                for s in site_perf
            ],
        })


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
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            order = PurchaseService.authorize_po(organization, pk)
            return Response({"message": "PO Authorized", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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


# =============================================================================
# RETURNS & CREDIT NOTES
# =============================================================================

class SalesReturnViewSet(TenantModelViewSet):
    """Handles sales returns with create, approve, cancel lifecycle."""
    queryset = SalesReturn.objects.all()
    serializer_class = SalesReturnSerializer

    @action(detail=False, methods=['post'])
    def create_return(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.create_sales_return(
                organization=organization,
                order_id=request.data.get('order_id'),
                return_date=request.data.get('return_date'),
                lines=request.data.get('lines', []),
                reason=request.data.get('reason'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(SalesReturnSerializer(result).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.approve_sales_return(
                organization=organization,
                return_id=pk,
                user=request.user if request.user.is_authenticated else None
            )
            return Response(SalesReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.cancel_sales_return(organization, pk)
            return Response(SalesReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class CreditNoteViewSet(TenantModelViewSet):
    """Read-only listing of auto-generated credit notes."""
    queryset = CreditNote.objects.all()
    serializer_class = CreditNoteSerializer


class PurchaseReturnViewSet(TenantModelViewSet):
    """Handles purchase returns with create and complete lifecycle."""
    queryset = PurchaseReturn.objects.all()
    serializer_class = PurchaseReturnSerializer

    @action(detail=False, methods=['post'])
    def create_return(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.create_purchase_return(
                organization=organization,
                order_id=request.data.get('order_id'),
                return_date=request.data.get('return_date'),
                lines=request.data.get('lines', []),
                reason=request.data.get('reason'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PurchaseReturnSerializer(result).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.complete_purchase_return(
                organization=organization,
                return_id=pk,
                warehouse_id=request.data.get('warehouse_id'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PurchaseReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# =============================================================================
# QUOTATIONS / PROFORMA
# =============================================================================

from decimal import Decimal
from django.db import transaction
from apps.pos.quotation_models import Quotation, QuotationLine
from apps.pos.serializers import QuotationSerializer, QuotationLineSerializer


class QuotationViewSet(TenantModelViewSet):
    """Full CRUD for quotations + lifecycle actions."""
    queryset = Quotation.objects.select_related('contact', 'user', 'site').prefetch_related('lines').all()
    serializer_class = QuotationSerializer

    @action(detail=True, methods=['post'], url_path='add-line')
    def add_line(self, request, pk=None):
        """Add a product line to a quotation."""
        quotation = self.get_object()
        if quotation.status not in ('DRAFT', 'SENT'):
            return Response({'error': 'Cannot modify quotation in this status'}, status=400)

        from apps.inventory.models import Product
        product_id = request.data.get('product_id')
        quantity = Decimal(str(request.data.get('quantity', 1)))
        unit_price_ttc = request.data.get('unit_price_ttc')
        line_discount = Decimal(str(request.data.get('discount', 0)))

        try:
            product = Product.objects.get(id=product_id, organization=quotation.organization)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)

        price_ttc = Decimal(str(unit_price_ttc)) if unit_price_ttc else product.selling_price_ttc
        price_ht = product.selling_price_ht or (price_ttc / (1 + product.tva_rate / 100))
        tax_rate = product.tva_rate or Decimal('0.00')
        total_ht = (price_ht * quantity) - line_discount
        tax_amount = total_ht * tax_rate / 100
        total_ttc = total_ht + tax_amount

        line = QuotationLine.objects.create(
            quotation=quotation,
            product=product,
            quantity=quantity,
            unit_price_ht=price_ht,
            unit_price_ttc=price_ttc,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            discount=line_discount,
            total_ht=total_ht,
            total_ttc=total_ttc,
            organization=quotation.organization,
        )
        quotation.recalculate_totals()
        return Response(QuotationLineSerializer(line).data, status=201)

    @action(detail=True, methods=['delete'], url_path='remove-line/(?P<line_id>[0-9]+)')
    def remove_line(self, request, pk=None, line_id=None):
        """Remove a line from a quotation."""
        quotation = self.get_object()
        deleted, _ = QuotationLine.objects.filter(quotation=quotation, id=line_id).delete()
        if deleted:
            quotation.recalculate_totals()
            return Response({'success': True})
        return Response({'error': 'Line not found'}, status=404)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status != 'DRAFT':
            return Response({'error': 'Only DRAFT quotations can be sent'}, status=400)
        quotation.status = 'SENT'
        quotation.save(update_fields=['status'])
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status not in ('DRAFT', 'SENT'):
            return Response({'error': 'Cannot accept this quotation'}, status=400)
        quotation.status = 'ACCEPTED'
        quotation.save(update_fields=['status'])
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status in ('CONVERTED',):
            return Response({'error': 'Cannot reject a converted quotation'}, status=400)
        quotation.status = 'REJECTED'
        quotation.save(update_fields=['status'])
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=['post'], url_path='convert-to-order')
    def convert_to_order(self, request, pk=None):
        """Convert a quotation into a sale order."""
        quotation = self.get_object()
        if quotation.status not in ('ACCEPTED', 'SENT', 'DRAFT'):
            return Response({'error': 'Quotation must be DRAFT/SENT/ACCEPTED'}, status=400)
        if quotation.converted_order:
            return Response({'error': 'Already converted', 'order_id': quotation.converted_order_id}, status=400)

        from apps.pos.models import Order, OrderLine
        from apps.finance.models import TransactionSequence

        with transaction.atomic():
            ref = TransactionSequence.next_value(quotation.organization, 'SALE')
            order = Order.objects.create(
                organization=quotation.organization,
                type='SALE', status='DRAFT', ref_code=ref,
                contact=quotation.contact,
                user=request.user if request.user.is_authenticated else quotation.user,
                site=quotation.site,
                total_amount=quotation.total_ttc,
                tax_amount=quotation.total_tax,
                discount=quotation.discount,
                notes=f"From quotation {quotation.reference or quotation.id}",
                scope='OFFICIAL',
            )
            for line in quotation.lines.all():
                OrderLine.objects.create(
                    organization=quotation.organization,
                    order=order, product=line.product,
                    quantity=line.quantity,
                    unit_price=line.unit_price_ttc,
                    unit_cost_ht=line.unit_price_ht,
                    unit_cost_ttc=line.unit_price_ttc,
                    vat_amount=line.tax_amount,
                    total=line.total_ttc,
                    total_amount=line.total_ttc,
                    tax_rate=line.tax_rate,
                )
            quotation.status = 'CONVERTED'
            quotation.converted_order = order
            quotation.save(update_fields=['status', 'converted_order'])

        return Response({
            'success': True,
            'order_id': order.id,
            'ref_code': order.ref_code,
            'quotation': QuotationSerializer(quotation).data,
        })


# =============================================================================
# DELIVERY / SHIPMENT
# =============================================================================

from apps.pos.delivery_models import DeliveryZone, DeliveryOrder
from apps.pos.serializers import DeliveryZoneSerializer, DeliveryOrderSerializer


class DeliveryZoneViewSet(TenantModelViewSet):
    """CRUD for delivery zones."""
    queryset = DeliveryZone.objects.all()
    serializer_class = DeliveryZoneSerializer


class DeliveryOrderViewSet(TenantModelViewSet):
    """CRUD for delivery orders + status transitions."""
    queryset = DeliveryOrder.objects.select_related('order', 'zone', 'driver').all()
    serializer_class = DeliveryOrderSerializer

    @action(detail=True, methods=['post'])
    def dispatch(self, request, pk=None):
        """Mark delivery as dispatched / in transit."""
        delivery = self.get_object()
        if delivery.status not in ('PENDING', 'PREPARING'):
            return Response({'error': f'Cannot dispatch from {delivery.status}'}, status=400)
        from django.utils import timezone
        delivery.status = 'IN_TRANSIT'
        delivery.dispatched_at = timezone.now()
        delivery.save(update_fields=['status', 'dispatched_at'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        """Mark delivery as completed."""
        delivery = self.get_object()
        if delivery.status != 'IN_TRANSIT':
            return Response({'error': 'Only IN_TRANSIT deliveries can be delivered'}, status=400)
        from django.utils import timezone
        delivery.status = 'DELIVERED'
        delivery.delivered_at = timezone.now()
        delivery.save(update_fields=['status', 'delivered_at'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def fail(self, request, pk=None):
        """Mark delivery as failed."""
        delivery = self.get_object()
        if delivery.status in ('DELIVERED', 'CANCELLED'):
            return Response({'error': 'Cannot fail this delivery'}, status=400)
        delivery.status = 'FAILED'
        delivery.notes = request.data.get('reason', delivery.notes)
        delivery.save(update_fields=['status', 'notes'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a delivery."""
        delivery = self.get_object()
        if delivery.status == 'DELIVERED':
            return Response({'error': 'Cannot cancel delivered orders'}, status=400)
        delivery.status = 'CANCELLED'
        delivery.save(update_fields=['status'])
        return Response(DeliveryOrderSerializer(delivery).data)


# =============================================================================
# DISCOUNT RULES
# =============================================================================

from apps.pos.discount_models import DiscountRule, DiscountUsageLog
from apps.pos.serializers import DiscountRuleSerializer, DiscountUsageLogSerializer


class DiscountRuleViewSet(TenantModelViewSet):
    """CRUD for discount rules + toggle and usage log."""
    queryset = DiscountRule.objects.select_related('product', 'category', 'brand', 'created_by').all()
    serializer_class = DiscountRuleSerializer

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """Toggle active/inactive."""
        rule = self.get_object()
        rule.is_active = not rule.is_active
        rule.save(update_fields=['is_active'])
        return Response(DiscountRuleSerializer(rule).data)

    @action(detail=True, methods=['get'], url_path='usage-log')
    def usage_log(self, request, pk=None):
        """Get usage log for this rule."""
        rule = self.get_object()
        logs = DiscountUsageLog.objects.filter(rule=rule).select_related('order', 'applied_by')[:50]
        return Response(DiscountUsageLogSerializer(logs, many=True).data)

    @action(detail=False, methods=['get'], url_path='active-rules')
    def active_rules(self, request):
        """Get all active & valid rules (for POS checkout)."""
        rules = self.get_queryset().filter(is_active=True)
        valid = [r for r in rules if r.is_valid]
        return Response(DiscountRuleSerializer(valid, many=True).data)


# =============================================================================
# CONSIGNMENT MANAGEMENT
# =============================================================================

from .consignment_models import ConsignmentSettlement, ConsignmentSettlementLine
from .serializers import ConsignmentSettlementSerializer, ConsignmentSettlementLineSerializer
from .models import OrderLine


class ConsignmentSettlementViewSet(TenantModelViewSet):
    """ViewSet for managing payouts to consignment suppliers."""
    queryset = ConsignmentSettlement.objects.select_related('supplier', 'performed_by').prefetch_related('lines').all()
    serializer_class = ConsignmentSettlementSerializer

    @action(detail=False, methods=['get'], url_path='pending-items')
    def pending_items(self, request):
        """
        Returns sold consignment items that have not yet been settled.
        Grouped by supplier.
        """
        organization_id = get_current_tenant_id()
        # Find OrderLines that are marked as consignment but not settled
        pending = OrderLine.objects.filter(
            organization_id=organization_id,
            is_consignment=True,
            consignment_settled=False,
            order__status__in=['COMPLETED', 'RECEIVED']
        ).select_related('order', 'product', 'order__contact', 'batch__supplier')

        data = []
        for line in pending:
            # We assume the batch links back to the original consignment inventory
            supplier = line.batch.supplier if line.batch else None
            data.append({
                'id': line.id,
                'order_id': line.order_id,
                'order_ref': line.order.ref_code,
                'product_name': line.product.name,
                'sku': line.product.sku,
                'quantity': line.quantity,
                'payout_amount': line.consignment_payout,
                'supplier_id': supplier.id if supplier else None,
                'supplier_name': supplier.name if supplier else 'Unknown',
                'sold_at': line.order.created_at,
            })
        
        return Response(data)

    @action(detail=False, methods=['post'], url_path='generate-settlement')
    def generate_settlement(self, request):
        """
        Create a settlement record for a list of order lines and a supplier.
        Body: { "supplier_id": 5, "line_ids": [10, 11, 12], "notes": "..." }
        """
        supplier_id = request.data.get('supplier_id')
        line_ids = request.data.get('line_ids', [])
        notes = request.data.get('notes', '')
        
        if not supplier_id or not line_ids:
            return Response({'error': 'Supplier and lines required'}, status=400)
            
        with transaction.atomic():
            lines = OrderLine.objects.filter(id__in=line_ids, is_consignment=True, consignment_settled=False)
            if not lines.exists():
                return Response({'error': 'No valid pending lines found'}, status=400)
                
            settlement = ConsignmentSettlement.objects.create(
                organization_id=get_current_tenant_id(),
                supplier_id=supplier_id,
                notes=notes,
                performed_by=request.user,
                status='PENDING'
            )
            
            for line in lines:
                ConsignmentSettlementLine.objects.create(
                    organization_id=settlement.organization_id,
                    settlement=settlement,
                    order_line=line,
                    payout_amount=line.consignment_payout
                )
                line.consignment_settled = True
                line.save(update_fields=['consignment_settled'])
                
            settlement.update_total()
            # Generate reference
            settlement.reference = f"CSL-{settlement.id}"
            settlement.save(update_fields=['reference'])
            
        return Response(ConsignmentSettlementSerializer(settlement).data)


class OrderViewSet(TenantModelViewSet):
    """CRUD for sales/purchase orders."""
    queryset = Order.objects.select_related('contact', 'user', 'site').all()
    serializer_class = OrderSerializer
    filterset_fields = ['type', 'status', 'contact', 'user']
    search_fields = ['ref_code', 'invoice_number', 'notes']
    ordering_fields = ['created_at', 'total_amount']


# ── Sourcing & Vendor Pricing ──────────────────────────────

from .sourcing_models import ProductSupplier, SupplierPriceHistory
from .serializers import ProductSupplierSerializer, SupplierPriceHistorySerializer


class ProductSupplierViewSet(TenantModelViewSet):
    queryset = ProductSupplier.objects.all()
    serializer_class = ProductSupplierSerializer

    @action(detail=False, methods=['get'], url_path='by-product/(?P<product_id>\d+)')
    def by_product(self, request, product_id=None):
        organization_id = get_current_tenant_id()
        suppliers = self.queryset.filter(product_id=product_id, organization_id=organization_id)
        serializer = self.get_serializer(suppliers, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='comparison')
    def comparison_dashboard(self, request):
        """Returns summarized sourcing intelligence for the dashboard."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No org"}, status=400)
        
        from django.db.models import Max, Min, Avg, Count
        
        # Products grouped with their suppliers
        stats = ProductSupplier.objects.filter(organization_id=organization_id, is_active=True).values(
            'product_id', 'product__name', 'product__sku', 'product__category__name'
        ).annotate(
            supplier_count=Count('supplier_id'),
            min_price=Min('last_purchased_price'),
            max_price=Max('last_purchased_price'),
            avg_price=Avg('last_purchased_price'),
            best_lead_time=Min('lead_time_days')
        ).order_by('product__name')

        return Response(stats)


class SupplierPriceHistoryViewSet(TenantModelViewSet):
    queryset = SupplierPriceHistory.objects.all()
    serializer_class = SupplierPriceHistorySerializer

    @action(detail=False, methods=['get'], url_path='trends/(?P<product_id>\\d+)')
    def trends(self, request, product_id=None):
        organization_id = get_current_tenant_id()
        history = self.queryset.filter(product_id=product_id, organization_id=organization_id).order_by('effective_date')
        serializer = self.get_serializer(history, many=True)
        return Response(serializer.data)


# =============================================================================
# PURCHASE ORDERS (Dedicated PO model with 10-state lifecycle)
# =============================================================================

from apps.pos.purchase_order_models import PurchaseOrder, PurchaseOrderLine
from apps.pos.serializers import PurchaseOrderSerializer, PurchaseOrderLineSerializer


class PurchaseOrderViewSet(TenantModelViewSet):
    """ViewSet for the dedicated PurchaseOrder model with 10-state lifecycle."""
    queryset = PurchaseOrder.objects.select_related(
        'supplier', 'site', 'warehouse', 'submitted_by', 'approved_by', 'created_by', 'invoice'
    ).prefetch_related('lines__product', 'lines__warehouse').all()
    serializer_class = PurchaseOrderSerializer
    filterset_fields = ['status', 'priority', 'supplier', 'purchase_sub_type']
    search_fields = ['po_number', 'supplier_name', 'notes']
    ordering_fields = ['created_at', 'total_amount', 'order_date', 'expected_date']

    @action(detail=False, methods=['get'], url_path='pending-invoice')
    def pending_invoice(self, request):
        supplier_id = request.query_params.get('supplier')
        qs = self.get_queryset().filter(status__in=['APPROVED', 'ORDERED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'IN_TRANSIT'])
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return Response(PurchaseOrderSerializer(qs, many=True).data)

    def get_queryset(self):
        qs = super().get_queryset()
        po_status = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        supplier_id = self.request.query_params.get('supplier')
        sub_type = self.request.query_params.get('purchase_sub_type')
        if po_status:
            qs = qs.filter(status=po_status)
        if priority:
            qs = qs.filter(priority=priority)
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        if sub_type:
            qs = qs.filter(purchase_sub_type=sub_type)
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        org = Organization.objects.get(id=org_id)
        serializer.save(
            organization=org,
            created_by=self.request.user,
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit PO for approval."""
        po = self.get_object()
        try:
            po.transition_to('SUBMITTED', user=request.user)
            return Response(PurchaseOrderSerializer(po).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted PO."""
        po = self.get_object()
        try:
            po.transition_to('APPROVED', user=request.user)
            return Response(PurchaseOrderSerializer(po).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a submitted PO."""
        po = self.get_object()
        try:
            po.transition_to('REJECTED', user=request.user,
                             reason=request.data.get('reason', ''))
            return Response(PurchaseOrderSerializer(po).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='send-to-supplier')
    def send_to_supplier(self, request, pk=None):
        """Mark PO as ordered / sent to supplier."""
        po = self.get_object()
        try:
            po.transition_to('ORDERED', user=request.user)
            return Response(PurchaseOrderSerializer(po).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='receive-line')
    def receive_line(self, request, pk=None):
        """Receive goods for a specific line."""
        po = self.get_object()
        line_id = request.data.get('line_id')
        qty = request.data.get('quantity')
        if not line_id or not qty:
            return Response({'error': 'line_id and quantity required'}, status=400)
        try:
            line = po.lines.get(id=line_id)
            from decimal import Decimal
            line.receive(Decimal(str(qty)))
            return Response(PurchaseOrderSerializer(po).data)
        except PurchaseOrderLine.DoesNotExist:
            return Response({'error': 'Line not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a PO."""
        po = self.get_object()
        try:
            po.transition_to('CANCELLED', user=request.user)
            return Response(PurchaseOrderSerializer(po).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='mark-invoiced')
    def mark_invoiced(self, request, pk=None):
        """Mark PO as invoiced."""
        po = self.get_object()
        try:
            po.transition_to('INVOICED', user=request.user)
            return Response(PurchaseOrderSerializer(po).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark PO as completed."""
        po = self.get_object()
        try:
            po.transition_to('COMPLETED', user=request.user)
            return Response(PurchaseOrderSerializer(po).data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='add-line')
    def add_line(self, request, pk=None):
        """Add a line item to a DRAFT PO."""
        po = self.get_object()
        if po.status != 'DRAFT':
            return Response({'error': 'Lines can only be added to DRAFT POs'}, status=400)
        try:
            line = PurchaseOrderLine.objects.create(
                order=po,
                organization=po.organization,
                product_id=request.data['product_id'],
                quantity=request.data.get('quantity', 1),
                unit_price=request.data.get('unit_price', 0),
                tax_rate=request.data.get('tax_rate', 0),
                discount_percent=request.data.get('discount_percent', 0),
                description=request.data.get('description', ''),
                warehouse_id=request.data.get('warehouse_id', po.warehouse_id),
                expected_date=request.data.get('expected_date'),
            )
            po.recalculate_totals()
            return Response(PurchaseOrderLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['delete'], url_path='remove-line/(?P<line_id>[0-9]+)')
    def remove_line(self, request, pk=None, line_id=None):
        """Remove a line from a DRAFT PO."""
        po = self.get_object()
        if po.status != 'DRAFT':
            return Response({'error': 'Lines can only be removed from DRAFT POs'}, status=400)
        deleted, _ = PurchaseOrderLine.objects.filter(order=po, id=line_id).delete()
        if deleted:
            po.recalculate_totals()
            return Response({'success': True})
        return Response({'error': 'Line not found'}, status=404)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """PO dashboard stats."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=400)

        from django.db.models import Count, Sum
        qs = PurchaseOrder.objects.filter(organization_id=organization_id)

        stats = {
            'total': qs.count(),
            'by_status': dict(qs.values_list('status').annotate(c=Count('id')).values_list('status', 'c')),
            'by_priority': dict(qs.values_list('priority').annotate(c=Count('id')).values_list('priority', 'c')),
            'total_value': float(qs.aggregate(t=Sum('total_amount'))['t'] or 0),
            'pending_approval': qs.filter(status='SUBMITTED').count(),
            'awaiting_receipt': qs.filter(status__in=['ORDERED', 'PARTIALLY_RECEIVED']).count(),
        }
        return Response(stats)


class PurchaseOrderLineViewSet(TenantModelViewSet):
    """Direct CRUD for PO lines (typically managed via PurchaseOrderViewSet)."""
    queryset = PurchaseOrderLine.objects.select_related('product', 'warehouse', 'order').all()
    serializer_class = PurchaseOrderLineSerializer


# ── POS Tickets (Cloud Sync) ───────────────────────────────────

from .models import PosTicket
from .serializers import PosTicketSerializer


class PosTicketViewSet(TenantModelViewSet):
    """Handles cloud synchronization of pending POS sessions."""
    queryset = PosTicket.objects.all()
    serializer_class = PosTicketSerializer

    def get_queryset(self):
        # Only show tickets for the current user in this organization
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(
            organization_id=get_current_tenant_id(),
            user=self.request.user
        )

    @action(detail=False, methods=['post'], url_path='sync-all')
    def sync_all(self, request):
        """
        Bulk sync tickets from frontend.
        Expects a list of tickets.
        Updates existing ones or creates new ones.
        """
        organization_id = get_current_tenant_id()
        tickets_data = request.data.get('tickets', [])
        synced_ids = []

        with transaction.atomic():
            for data in tickets_data:
                ticket_id = data.get('ticket_id')
                if not ticket_id: continue
                
                ticket, _ = PosTicket.objects.update_or_create(
                    organization_id=organization_id,
                    user=request.user,
                    ticket_id=ticket_id,
                    defaults={
                        'name': data.get('name', 'Untitled'),
                        'client_id': data.get('client_id'),
                        'cart_data': data.get('cart_data', []),
                    }
                )
                synced_ids.append(ticket_id)

        return Response({"status": "synced", "count": len(synced_ids)})
