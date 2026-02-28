from apps.inventory.models import (
    Brand,
    Category,
    ComboComponent,
    Inventory,
    InventoryMovement,
    OperationalRequestLine,
    Parfum,
    Product,
    ProductGroup,
    Unit,
)
from apps.inventory.serializers import (
    ComboComponentSerializer,
    ProductCreateSerializer,
    ProductSerializer,
    StorefrontProductSerializer,
)
from .base import (
    AnonRateThrottle,
    Coalesce,
    Count,
    DecimalField,
    Organization,
    Q,
    Response,
    Sum,
    TenantModelViewSet,
    _get_org_or_400,
    action,
    permissions,
    status,
    timezone,
    timedelta,
    transaction,
)
from erp.mixins import UDLEViewSetMixin


class StorefrontThrottle(AnonRateThrottle):
    rate = '30/minute'

class ProductStorefrontMixin:

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny],
            throttle_classes=[StorefrontThrottle])
    def storefront(self, request):
        """
        Public endpoint for tenant storefronts.
        Throttled, paginated, and returns limited fields.
        """
        slug = request.query_params.get('organization_slug') or request.query_params.get('organizationSlug')
        if not slug:
            return Response({"error": "Organization slug required"}, status=400)

        try:
            org = Organization.objects.get(slug=slug)
            products = Product.objects.filter(
                organization=org, status='ACTIVE'
            ).select_related('brand', 'category', 'unit').prefetch_related(
                'variants__attribute_values__attribute'
            )[:100]

            serializer = StorefrontProductSerializer(products, many=True)
            return Response(serializer.data)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=404)

