"""
Supplier Portal — URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

# Admin-side endpoints
router.register(r'config', views.SupplierPortalConfigViewSet, basename='supplier-portal-config')
router.register(r'portal-access', views.SupplierPortalAccessViewSet)
router.register(r'admin-proformas', views.SupplierProformaAdminViewSet, basename='admin-proformas')
router.register(r'admin-price-requests', views.PriceChangeRequestAdminViewSet, basename='admin-price-requests')
router.register(r'proforma-lines', views.ProformaLineViewSet)

# Supplier-side endpoints
router.register(r'dashboard', views.SupplierDashboardViewSet, basename='supplier-dashboard')
router.register(r'my-orders', views.SupplierOrdersViewSet, basename='supplier-orders')
router.register(r'my-stock', views.SupplierStockViewSet, basename='supplier-stock')
router.register(r'my-proformas', views.SupplierProformaViewSet, basename='supplier-proformas')
router.register(r'my-price-requests', views.SupplierPriceChangeViewSet, basename='supplier-price-requests')
router.register(r'my-notifications', views.SupplierNotificationViewSet, basename='supplier-notifications')

urlpatterns = [
    # Portal auth (public)
    path('portal-auth/login/', views.SupplierPortalLoginView.as_view(), name='supplier-portal-login'),

    # Router URLs
    path('', include(router.urls)),
]
