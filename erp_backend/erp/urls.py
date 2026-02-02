from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrganizationViewSet, health_check

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'accounts', FinancialAccountViewSet)
router.register(r'coa', ChartOfAccountViewSet)
router.register(r'fiscal-years', FiscalYearViewSet)
router.register(r'fiscal-periods', FiscalPeriodViewSet)
router.register(r'journal', JournalEntryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'inventory', InventoryViewSet)

urlpatterns = [
    path('health/', health_check),
    path('', include(router.urls)),
]
