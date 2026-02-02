from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, SiteViewSet, FinancialAccountViewSet,
    ChartOfAccountViewSet, FiscalYearViewSet, FiscalPeriodViewSet,
    JournalEntryViewSet, ProductViewSet, WarehouseViewSet,
    InventoryViewSet, UnitViewSet, SettingsViewSet, health_check,
    InventoryViewSet, UnitViewSet, SettingsViewSet, health_check,
    POSViewSet, PurchaseViewSet, TenantResolutionView,
    BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet,
    CountryViewSet
)

router = DefaultRouter()
router.register(r'tenant', TenantResolutionView, basename='tenant')
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'accounts', FinancialAccountViewSet)
router.register(r'coa', ChartOfAccountViewSet)
router.register(r'fiscal-years', FiscalYearViewSet)
router.register(r'fiscal-periods', FiscalPeriodViewSet)
router.register(r'journal', JournalEntryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'units', UnitViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'inventory', InventoryViewSet)
router.register(r'settings', SettingsViewSet, basename='settings')
router.register(r'pos', POSViewSet, basename='pos')
router.register(r'purchase', PurchaseViewSet, basename='purchase')
router.register(r'brands', BrandViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'parfums', ParfumViewSet)
router.register(r'product-groups', ProductGroupViewSet)
router.register(r'countries', CountryViewSet)

urlpatterns = [
    path('health/', health_check),
    path('', include(router.urls)),
]
