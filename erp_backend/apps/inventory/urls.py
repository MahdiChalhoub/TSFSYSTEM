"""
Inventory Module URL Configuration
Routes for product catalog, stock management, and warehouse operations.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.inventory.views import (
    ProductViewSet, UnitViewSet, WarehouseViewSet, InventoryViewSet,
    BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet,
    InventoryMovementViewSet
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

urlpatterns = [
    path('', include(router.urls)),
]

