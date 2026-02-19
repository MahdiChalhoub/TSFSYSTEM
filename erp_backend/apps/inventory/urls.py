"""
Inventory Module URL Configuration
Routes for product catalog, stock management, warehouse operations, and stock counting.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.inventory.views import (
    ProductViewSet, UnitViewSet, WarehouseViewSet, InventoryViewSet,
    BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet,
    InventoryMovementViewSet,
    StockAdjustmentOrderViewSet, StockTransferOrderViewSet,
    OperationalRequestViewSet, ProductSerialViewSet, SerialLogViewSet,
    StockAlertViewSet,
)
from apps.inventory.counting_views import (
    InventorySessionViewSet, InventorySessionLineViewSet,
)

router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'units', UnitViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'inventory', InventoryViewSet)
router.register(r'brands', BrandViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'parfums', ParfumViewSet)
router.register(r'product-groups', ProductGroupViewSet)
router.register(r'inventory-movements', InventoryMovementViewSet)
router.register(r'adjustment-orders', StockAdjustmentOrderViewSet)
router.register(r'transfer-orders', StockTransferOrderViewSet)
router.register(r'requests', OperationalRequestViewSet)
router.register(r'counting-sessions', InventorySessionViewSet, basename='counting-sessions')
router.register(r'counting-lines', InventorySessionLineViewSet, basename='counting-lines')
router.register(r'serials', ProductSerialViewSet)
router.register(r'serial-logs', SerialLogViewSet)
router.register(r'stock-alerts', StockAlertViewSet, basename='stock-alerts')

urlpatterns = [
    path('', include(router.urls)),
]
