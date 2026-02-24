from .taxonomy_views import (
    BrandViewSet,
    CategoryViewSet,
    ParfumViewSet,
    ProductGroupViewSet,
    UnitViewSet,
)
from .product_views import ProductViewSet
from .warehouse_views import WarehouseViewSet
from .inventory_views import (
    InventoryMovementViewSet,
    InventoryViewSet,
    OperationalRequestViewSet,
    ProductSerialViewSet,
    SerialLogViewSet,
    StockAdjustmentOrderViewSet,
    StockAlertViewSet,
    StockTransferOrderViewSet,
)

__all__ = [
    'BrandViewSet',
    'CategoryViewSet',
    'ParfumViewSet',
    'ProductGroupViewSet',
    'UnitViewSet',
    'ProductViewSet',
    'WarehouseViewSet',
    'InventoryMovementViewSet',
    'InventoryViewSet',
    'OperationalRequestViewSet',
    'ProductSerialViewSet',
    'SerialLogViewSet',
    'StockAdjustmentOrderViewSet',
    'StockAlertViewSet',
    'StockTransferOrderViewSet',
]
