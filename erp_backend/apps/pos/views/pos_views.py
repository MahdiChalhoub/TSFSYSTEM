from .base import (
    viewsets, status, Response, action, get_current_tenant_id,
    Organization, Warehouse, PDFService, HttpResponse, timezone
)
from apps.pos.models import Order, PosTicket
from apps.pos.services import POSService
from apps.pos.serializers import OrderSerializer, PosTicketSerializer

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
            requested_scope = request.data.get('scope', 'OFFICIAL').upper()
            
            # --- STRICT SCOPE ENFORCEMENT ---
            from erp.middleware import get_authorized_scope
            authorized = get_authorized_scope() or 'official'
            if authorized == 'official' and requested_scope == 'INTERNAL':
                 return Response({"error": "Unauthorized: Your session is restricted to Official scope and cannot create Internal orders."}, status=403)
            
            scope = requested_scope
            user = request.user
            if user.is_anonymous:
                from erp.models import User
                user = User.objects.filter(organization=organization, is_staff=True).first()
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
            order = POSService.checkout(
                organization=organization, user=user, warehouse=warehouse,
                payment_account_id=payment_account_id, items=items, scope=scope,
                contact_id=request.data.get('contact_id'),
                payment_method=request.data.get('payment_method', 'CASH'),
                points_redeemed=request.data.get('points_redeemed', 0),
                store_change_in_wallet=request.data.get('store_change_in_wallet', False),
                cash_received=request.data.get('cash_received', 0),
                notes=request.data.get('notes', ''),
                global_discount=request.data.get('global_discount', 0),
                payment_legs=request.data.get('payment_legs', [])
            )
            return Response({
                "message": "Checkout successful",
                "order_id": order.id,
                "ref": order.invoice_number,
                "total_amount": float(order.total_amount)
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='daily-summary')
    def daily_summary(self, request):
        """Daily cash register summary with payment breakdown."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)

        from django.db.models import Sum, Count, Q
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

        # Scope filtering with strict isolation
        from erp.middleware import get_authorized_scope
        authorized = get_authorized_scope() or 'official'
        scope = (request.query_params.get('scope') or request.headers.get('X-Scope') or 'OFFICIAL').upper()
        
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'
        
        orders = Order.objects.filter(
            organization=organization,
            scope=scope.upper(),
            created_at__gte=start,
            created_at__lte=end,
        )

        # Overall stats
        sales = orders.filter(type='SALE').aggregate(
            count=Count('id'), total=Sum('total_amount'), tax=Sum('tax_amount'), discount=Sum('discount_amount')
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
        from datetime import timedelta
        from apps.pos.models import OrderLine

        days = int(request.query_params.get('days', '30'))
        end = timezone.now()
        start = end - timedelta(days=days)

        # Scope filtering with strict isolation
        from erp.middleware import get_authorized_scope
        authorized = get_authorized_scope() or 'official'
        scope = (request.query_params.get('scope') or request.headers.get('X-Scope') or 'OFFICIAL').upper()
        
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'

        sales = Order.objects.filter(
            organization=organization, type='SALE',
            scope=scope.upper(),
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


class PosTicketViewSet(viewsets.ModelViewSet):
    """Handles cloud synchronization of pending POS sessions."""
    queryset = PosTicket.objects.all()
    serializer_class = PosTicketSerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return self.queryset.filter(organization_id=org_id)

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        serializer.save(organization=organization)

    @action(detail=False, methods=['post'], url_path='sync-all')
    def sync_all(self, request):
        """
        Bulk sync tickets from frontend.
        Expects a list of tickets.
        Updates existing ones or creates new ones.
        """
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        
        # Robust handling: supports direct [{}, {}] OR { "tickets": [{}, {}] }
        data_in = request.data
        if isinstance(data_in, dict) and 'tickets' in data_in:
            tickets_data = data_in['tickets']
        else:
            tickets_data = data_in

        if not isinstance(tickets_data, list):
            return Response({"error": "Expected a list of tickets (directly or via 'tickets' key)"}, status=400)

        results = []
        for data in tickets_data:
            ticket_id = data.get('id')
            if ticket_id:
                try:
                    ticket = PosTicket.objects.get(id=ticket_id, organization=organization)
                    serializer = PosTicketSerializer(ticket, data=data, partial=True)
                except PosTicket.DoesNotExist:
                    serializer = PosTicketSerializer(data=data)
            else:
                serializer = PosTicketSerializer(data=data)

            if serializer.is_valid():
                serializer.save(organization=organization)
                results.append(serializer.data)
            else:
                results.append({"error": serializer.errors, "data": data})

        return Response({"synced": len(results), "details": results})
