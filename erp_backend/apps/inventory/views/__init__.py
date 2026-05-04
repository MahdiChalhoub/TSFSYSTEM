from .taxonomy_views import (
    BrandViewSet,
    CategoryViewSet,
    ParfumViewSet,
    ProductGroupViewSet,
    UnitViewSet,
    UnitPackageViewSet,
    PackagingSuggestionRuleViewSet,
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
from .counting_views import InventorySessionViewSet, InventorySessionLineViewSet, SyncViewSet
from .location_views import (
    WarehouseZoneViewSet, WarehouseAisleViewSet, WarehouseRackViewSet,
    WarehouseShelfViewSet, WarehouseBinViewSet, ProductLocationViewSet
)
from .stock_move_views import StockMoveViewSet, WarehouseStockView
from .goods_receipt_views import GoodsReceiptViewSet
from .intelligence_views import IntelligenceViewSet
from .grouping_views import InventoryGroupViewSet, InventoryGroupMemberViewSet

__all__ = [
    'BrandViewSet',
    'CategoryViewSet',
    'ParfumViewSet',
    'ProductGroupViewSet',
    'UnitViewSet',
    'UnitPackageViewSet',
    'PackagingSuggestionRuleViewSet',
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
    'InventorySessionViewSet', 'InventorySessionLineViewSet', 'SyncViewSet',
    'WarehouseZoneViewSet', 'WarehouseAisleViewSet', 'WarehouseRackViewSet',
    'WarehouseShelfViewSet', 'WarehouseBinViewSet', 'ProductLocationViewSet',
    'StockMoveViewSet', 'WarehouseStockView',
    'GoodsReceiptViewSet',
    'IntelligenceViewSet',
    'InventoryGroupViewSet', 'InventoryGroupMemberViewSet',
]
