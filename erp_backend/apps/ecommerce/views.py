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
            from apps.inventory.models import Product
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

class OrderViewSet(TenantModelViewSet):
    """eCommerce order management."""
    queryset = Order.objects.select_related('contact').prefetch_related('lines').all()
    serializer_class = OrderSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Dashboard stats for eCommerce orders."""
        org = getattr(request, 'organization', None)
        qs = self.get_queryset()
        if org:
            qs = qs.filter(organization=org)

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        placed = qs.exclude(status='CART')
        monthly = placed.filter(placed_at__gte=month_start)

        total_orders = placed.count()
        monthly_orders = monthly.count()
        monthly_revenue = monthly.aggregate(r=Sum('total'))['r'] or Decimal('0.00')

        by_status = dict(placed.values_list('status').annotate(c=Count('id')).values_list('status', 'c'))

        return Response({
            'total_orders': total_orders,
            'monthly_orders': monthly_orders,
            'monthly_revenue': str(monthly_revenue),
            'by_status': by_status,
            'pending': by_status.get('PLACED', 0) + by_status.get('CONFIRMED', 0),
            'processing': by_status.get('PROCESSING', 0),
            'shipped': by_status.get('SHIPPED', 0),
            'delivered': by_status.get('DELIVERED', 0),
        })


# =============================================================================
# STOREFRONT CONFIG — Admin viewset
# =============================================================================

class StorefrontConfigViewSet(TenantModelViewSet):
    """Manage storefront configuration (theme, store mode, etc.)."""
    queryset = StorefrontConfig.objects.all()
    serializer_class = StorefrontConfigSerializer
