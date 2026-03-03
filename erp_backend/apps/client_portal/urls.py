"""
Client Portal — URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

# Admin-side endpoints
router.register(r'client-access', views.ClientPortalAccessViewSet)
router.register(r'admin-orders', views.ClientOrderAdminViewSet, basename='admin-client-orders')
router.register(r'admin-tickets', views.ClientTicketAdminViewSet, basename='admin-client-tickets')
router.register(r'admin-wallets', views.ClientWalletAdminViewSet, basename='admin-client-wallets')
router.register(r'order-lines', views.ClientOrderLineViewSet)
router.register(r'config', views.ClientPortalConfigViewSet, basename='client-portal-config')
router.register(r'quote-requests', views.QuoteRequestViewSet, basename='quote-requests')
router.register(r'coupons', views.CouponAdminViewSet, basename='coupons')
router.register(r'cart-promotions', views.CartPromotionViewSet, basename='cart-promotions')
router.register(r'shipping-rates', views.ShippingRateViewSet, basename='shipping-rates')

# Client-side endpoints
router.register(r'dashboard', views.ClientDashboardViewSet, basename='client-dashboard')
router.register(r'my-orders', views.ClientMyOrdersViewSet, basename='client-orders')
router.register(r'my-wallet', views.ClientWalletViewSet, basename='client-wallet')
router.register(r'my-tickets', views.ClientMyTicketsViewSet, basename='client-tickets')
router.register(r'reviews', views.ProductReviewViewSet, basename='product-reviews')
router.register(r'wishlist', views.WishlistItemViewSet, basename='wishlist')

urlpatterns = [
    # Portal auth (public)
    path('portal-auth/login/', views.ClientPortalLoginView.as_view(), name='client-portal-login'),
    path('portal-auth/register/', views.ClientPortalRegisterView.as_view(), name='client-portal-register'),
    path('storefront/config/', views.StorefrontPublicConfigView.as_view(), name='storefront-config'),

    # Router URLs
    path('', include(router.urls)),
]
