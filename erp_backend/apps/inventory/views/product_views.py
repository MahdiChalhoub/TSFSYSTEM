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


from .product_bulk import ProductBulkMixin
from .product_analytics import ProductAnalyticsMixin
from .product_combo import ProductComboMixin
from .product_storefront import ProductStorefrontMixin

class ProductViewSet(ProductBulkMixin, ProductAnalyticsMixin, ProductComboMixin, ProductStorefrontMixin, UDLEViewSetMixin, TenantModelViewSet):




    queryset = Product.objects.select_related(
        'brand', 'country', 'category', 'unit', 'parfum', 'size_unit', 'product_group'
    ).all()

    serializer_class = ProductSerializer

    filterset_fields = ['category', 'brand', 'product_type', 'is_active', 'tracks_serials']

    search_fields = ['name', 'sku', 'barcode', 'description']

    ordering_fields = ['name', 'sku', 'selling_price_ttc', 'cost_price', 'stock_level', 'created_at']
