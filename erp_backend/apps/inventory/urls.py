"""
Inventory Module URL Configuration
Routes for product catalog, stock management, warehouse operations, stock counting, and warehouse locations.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.inventory.views import (
    ProductViewSet, UnitViewSet, UnitPackageViewSet, WarehouseViewSet, InventoryViewSet,
    BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet,
    PackagingSuggestionRuleViewSet,
    InventoryMovementViewSet,
    StockAdjustmentOrderViewSet, StockTransferOrderViewSet,
    OperationalRequestViewSet, ProductSerialViewSet, SerialLogViewSet,
    StockAlertViewSet,
)
from apps.inventory.views.taxonomy_views import ProductPackagingViewSet
from apps.inventory.views.attribute_views import ProductAttributeViewSet
from apps.inventory.views.counting_views import (
    InventorySessionViewSet, InventorySessionLineViewSet,
)
from apps.inventory.views.location_views import (
    WarehouseZoneViewSet, WarehouseAisleViewSet, WarehouseRackViewSet,
    WarehouseShelfViewSet, WarehouseBinViewSet, ProductLocationViewSet,
)
from kernel.audit.views import AuditTrailViewSet

router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'units', UnitViewSet)
router.register(r'unit-packages', UnitPackageViewSet, basename='unit-packages')
router.register(r'product-packaging', ProductPackagingViewSet, basename='product-packaging')
router.register(r'product-attributes', ProductAttributeViewSet, basename='product-attributes')
router.register(r'packaging-suggestions', PackagingSuggestionRuleViewSet, basename='packaging-suggestions')
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
router.register(r'audit-trail', AuditTrailViewSet, basename='audit-trail')

# Warehouse Location System
router.register(r'zones', WarehouseZoneViewSet, basename='warehouse-zones')
router.register(r'aisles', WarehouseAisleViewSet, basename='warehouse-aisles')
router.register(r'racks', WarehouseRackViewSet, basename='warehouse-racks')
router.register(r'shelves', WarehouseShelfViewSet, basename='warehouse-shelves')
router.register(r'bins', WarehouseBinViewSet, basename='warehouse-bins')
router.register(r'product-locations', ProductLocationViewSet, basename='product-locations')

urlpatterns = [
    path('', include(router.urls)),
]
