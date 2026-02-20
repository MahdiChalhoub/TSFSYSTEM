"""
eCommerce — URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'orders', views.OrderViewSet, basename='ecommerce-orders')
router.register(r'storefront-config', views.StorefrontConfigViewSet, basename='storefront-config')

urlpatterns = [
    # Public endpoints (no auth)
    path('catalog/', views.CatalogView.as_view(), name='ecommerce-catalog'),
    path('themes/', views.ThemeListView.as_view(), name='ecommerce-themes'),

    # Router URLs (auth required)
    path('', include(router.urls)),
]
