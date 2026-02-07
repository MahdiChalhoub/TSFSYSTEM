"""
Inventory Module URL Configuration
Routes for product catalog, stock management, and warehouse operations.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from erp.views import (
    ProductViewSet, UnitViewSet, WarehouseViewSet, InventoryViewSet,
    BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet
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

urlpatterns = [
    path('', include(router.urls)),
]
