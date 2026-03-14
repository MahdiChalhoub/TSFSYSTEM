"""
eCommerce — Views
=================
Module-level API endpoints for the eCommerce storefront.
Provides catalog access, order stats, theme listing, and storefront config.
"""
import logging
from decimal import Decimal
from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from erp.views import TenantModelViewSet
from .models import Order, OrderLine, StorefrontConfig
from .serializers import OrderSerializer, StorefrontConfigSerializer

logger = logging.getLogger(__name__)


# =============================================================================
# CATALOG — Public product listing for storefronts
# =============================================================================

class CatalogView(APIView):
    """
    Public product catalog for the storefront.
    Reads from inventory.Product, filtered by organization.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        slug = request.query_params.get('slug', '')
        if not slug:
            return Response({'error': 'slug parameter required'}, status=400)

        from erp.models import Organization
        try:
            org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)

        # Get products from inventory
        try:
            from erp.connector_registry import connector
            Product = connector.require('inventory.products.get_model', org_id=org.id, source='ecommerce.catalog')
            if not Product:
                return Response({'results': [], 'total': 0, 'page': 1, 'per_page': 24, 'total_pages': 0})
            products = Product.objects.filter(
                organization=org,
                is_active=True,
            ).select_related('category').order_by('-created_at')

            # Apply filters
            category = request.query_params.get('category')
            search = request.query_params.get('search', '')
            sort = request.query_params.get('sort', '-created_at')

            if category:
                products = products.filter(category__name__iexact=category)
            if search:
                products = products.filter(
                    Q(name__icontains=search) | Q(description__icontains=search)
                )

            # Sorting
            sort_map = {
                'price_asc': 'price',
                'price_desc': '-price',
                'name_asc': 'name',
                'name_desc': '-name',
                'newest': '-created_at',
            }
            products = products.order_by(sort_map.get(sort, '-created_at'))

            # Pagination
            page = int(request.query_params.get('page', 1))
            per_page = int(request.query_params.get('per_page', 24))
            total = products.count()
            start = (page - 1) * per_page
            items = products[start:start + per_page]

            data = [{
                'id': str(p.pk),
                'name': p.name,
                'description': p.description or '',
                'price': str(p.price) if hasattr(p, 'price') else '0.00',
                'category': p.category.name if p.category else None,
                'image': p.image.url if hasattr(p, 'image') and p.image else None,
                'stock': getattr(p, 'stock_quantity', 0),
                'is_active': p.is_active,
            } for p in items]

            return Response({
                'results': data,
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page,
            })

        except Exception as e:
            logger.error(f'[eCommerce] Catalog error: {e}')
            return Response({'results': [], 'total': 0, 'page': 1, 'per_page': 24, 'total_pages': 0})


# =============================================================================
# THEMES — Available theme listing
# =============================================================================

class ThemeListView(APIView):
    """List all available storefront themes."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        # Theme configs are defined in the frontend ThemeRegistry,
        # but we expose a lightweight summary here for API consumers.
        themes = [
            {
                'id': 'midnight',
                'name': 'Midnight',
                'description': 'Premium dark e-commerce theme with emerald accents.',
                'colors': {
                    'primary': '#10b981',
                    'secondary': '#6366f1',
                    'background': '#020617',
                },
            },
            {
                'id': 'boutique',
                'name': 'Boutique',
                'description': 'Clean, light, and elegant. Refined for curated collections.',
                'colors': {
                    'primary': '#8b5cf6',
                    'secondary': '#ec4899',
                    'background': '#faf5ff',
                },
            },
            {
                'id': 'emporium',
                'name': 'Emporium',
                'description': 'Elite marketplace theme for massive catalogs. Industrial-strength navigation.',
                'colors': {
                    'primary': '#facc15',
                    'secondary': '#1e293b',
                    'background': '#f8fafc',
                },
            },
        ]
        return Response({'themes': themes})


# =============================================================================
# ORDERS — Admin viewset for eCommerce orders
# =============================================================================

# Valid state machine transitions for admin-side order management
ALLOWED_TRANSITIONS = {
    'PLACED':      ['CONFIRMED', 'CANCELLED'],
    'CONFIRMED':   ['PROCESSING', 'CANCELLED'],
    'PROCESSING':  ['SHIPPED', 'CANCELLED'],
    'SHIPPED':     ['DELIVERED', 'RETURNED'],
    'DELIVERED':   ['RETURNED'],
    'CANCELLED':   [],
    'RETURNED':    [],
}


class OrderViewSet(TenantModelViewSet):
    """eCommerce order management."""
    queryset = Order.objects.select_related('contact').prefetch_related('lines').all()
    serializer_class = OrderSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Full eCommerce analytics dashboard.

        Query params (all optional):
          ?from=YYYY-MM-DD   start date (default: 30 days ago)
          ?to=YYYY-MM-DD     end date   (default: today)
          ?period=daily|weekly|monthly  series grouping (default: daily)

        Returns:
          summary   → GMV, orders, AOV, paid/cancelled/pending counts
          by_status → {PLACED: n, CONFIRMED: n, ...}
          top_products → top 10 by revenue in the period
          series    → [{date, gmv, orders_count}] for the requested period
        """
        from django.db.models import Sum, Count, Avg, F
        from django.db.models.functions import TruncDay, TruncWeek, TruncMonth
        import datetime

        org = getattr(request, 'organization', None)
        qs = self.get_queryset().exclude(status='CART')

        # ── Date range ──────────────────────────────────────────────────────
        today = timezone.now().date()
        raw_from = request.query_params.get('from')
        raw_to   = request.query_params.get('to')
        try:
            date_from = datetime.date.fromisoformat(raw_from) if raw_from else today - datetime.timedelta(days=30)
            date_to   = datetime.date.fromisoformat(raw_to)   if raw_to   else today
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        period_qs = qs.filter(placed_at__date__gte=date_from, placed_at__date__lte=date_to)

        # ── Summary ─────────────────────────────────────────────────────────
        agg = period_qs.aggregate(
            gmv=Sum('total_amount'),
            orders_count=Count('id'),
            avg_order_value=Avg('total_amount'),
        )
        gmv              = agg['gmv'] or Decimal('0.00')
        orders_count     = agg['orders_count'] or 0
        aov              = agg['avg_order_value'] or Decimal('0.00')
        paid_count       = period_qs.filter(payment_status='PAID').count()
        cancelled_count  = period_qs.filter(status='CANCELLED').count()
        pending_payment  = period_qs.exclude(payment_status='PAID').exclude(status='CANCELLED').count()

        # ── By Status ────────────────────────────────────────────────────────
        by_status = dict(
            period_qs.values_list('status').annotate(c=Count('id')).values_list('status', 'c')
        )

        # ── Top Products ─────────────────────────────────────────────────────
        from apps.client_portal.models import ClientOrderLine
        top_products_qs = (
            ClientOrderLine.objects
            .filter(
                order__organization=org,
                order__status__in=['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
                order__placed_at__date__gte=date_from,
                order__placed_at__date__lte=date_to,
            )
            .values('product_id', 'product_name')
            .annotate(
                revenue=Sum(F('quantity') * F('unit_price')),
                qty_sold=Sum('quantity'),
                orders_count=Count('order_id', distinct=True),
            )
            .order_by('-revenue')[:10]
        )
        top_products = [
            {
                'product_id': r['product_id'],
                'name': r['product_name'],
                'revenue': str(r['revenue'] or '0.00'),
                'qty_sold': str(r['qty_sold'] or '0'),
                'orders_count': r['orders_count'],
            }
            for r in top_products_qs
        ]

        # ── Date Series ──────────────────────────────────────────────────────
        period = request.query_params.get('period', 'daily')
        trunc_fn = {'daily': TruncDay, 'weekly': TruncWeek, 'monthly': TruncMonth}.get(period, TruncDay)
        series_qs = (
            period_qs
            .annotate(period=trunc_fn('placed_at'))
            .values('period')
            .annotate(gmv=Sum('total_amount'), orders_count=Count('id'))
            .order_by('period')
        )
        series = [
            {
                'date': r['period'].date().isoformat() if r['period'] else None,
                'gmv': str(r['gmv'] or '0.00'),
                'orders_count': r['orders_count'],
            }
            for r in series_qs
        ]

        return Response({
            'period': {'from': date_from.isoformat(), 'to': date_to.isoformat(), 'grouping': period},
            'summary': {
                'gmv': str(gmv),
                'orders_count': orders_count,
                'aov': str(round(aov, 2)),
                'paid_count': paid_count,
                'cancelled_count': cancelled_count,
                'pending_payment_count': pending_payment,
            },
            'by_status': by_status,
            'top_products': top_products,
            'series': series,
        })

    @action(detail=True, methods=['post'], url_path='transition')
    def transition_status(self, request, pk=None):
        """
        Admin-side order status transition with guard rules.

        Body:
            { "status": "CONFIRMED", "note": "optional note" }

        Allowed transitions:
            PLACED      → CONFIRMED | CANCELLED
            CONFIRMED   → PROCESSING | CANCELLED
            PROCESSING  → SHIPPED | CANCELLED
            SHIPPED     → DELIVERED | RETURNED
            DELIVERED   → RETURNED
        """
        order = self.get_object()
        new_status = request.data.get('status', '').upper()
        note = request.data.get('note', '')

        if not new_status:
            return Response({'error': 'status is required'}, status=status.HTTP_400_BAD_REQUEST)

        allowed = ALLOWED_TRANSITIONS.get(order.status, [])
        if new_status not in allowed:
            return Response(
                {
                    'error': f"Cannot transition from '{order.status}' to '{new_status}'.",
                    'current_status': order.status,
                    'allowed_transitions': allowed,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_status = order.status
        order.status = new_status

        # Append timestamped note to order notes
        if note:
            from django.utils import timezone as tz
            timestamp = tz.now().strftime('%Y-%m-%d %H:%M')
            order.notes = (order.notes or '') + f"\n[{timestamp}] {old_status}→{new_status}: {note}"

        # On DELIVERED: post loyalty points to customer wallet
        if new_status == 'DELIVERED' and order.contact:
            try:
                from apps.client_portal.models import ClientPortalConfig
                config = ClientPortalConfig.get_config(order.organization)
                if config.loyalty_enabled:
                    points = config.get_points_for_amount(order.total_amount)
                    if points > 0:
                        wallet = order.contact.wallet
                        wallet.add_loyalty_points(points)
                        logger.info(f"[eCommerce] +{points} loyalty points posted for order {order.order_number}")
            except Exception as exc:
                logger.warning(f"[eCommerce] Loyalty post failed on delivery: {exc}")

        order.save(update_fields=['status', 'notes', 'updated_at'])
        logger.info(f"[eCommerce] Order {order.order_number}: {old_status} → {new_status} by {request.user}")

        return Response({
            'order_number': order.order_number,
            'previous_status': old_status,
            'new_status': new_status,
            'allowed_next': ALLOWED_TRANSITIONS.get(new_status, []),
        })

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        """
        Admin confirms manual payment (COD or bank transfer).
        Sets payment_status=PAID and posts loyalty points.

        Body: { "method": "CASH" }  (optional, defaults to existing payment_method)
        """
        order = self.get_object()
        if order.payment_status == 'PAID':
            return Response({'error': 'Order is already marked as paid.'}, status=400)

        try:
            from erp.connector_registry import connector
            PaymentGatewayService = connector.require('finance.gateways.get_payment_service', org_id=order.organization_id, source='ecommerce.payment')
            if not PaymentGatewayService:
                return Response({'error': 'Payment gateway service not available.'}, status=503)
        except Exception:
            return Response({'error': 'Finance payment module not available.'}, status=503)
        success = PaymentGatewayService.confirm_manual_payment(order, confirmed_by_user=request.user)

        if success:
            return Response({
                'order_number': order.order_number,
                'payment_status': 'PAID',
                'message': 'Payment confirmed successfully.',
            })
        return Response({'error': 'Failed to confirm payment.'}, status=500)


# =============================================================================
# STOREFRONT CONFIG — Admin viewset
# =============================================================================

class StorefrontConfigViewSet(TenantModelViewSet):
    """Manage storefront configuration (theme, store mode, etc.)."""
    queryset = StorefrontConfig.objects.all()
    serializer_class = StorefrontConfigSerializer
