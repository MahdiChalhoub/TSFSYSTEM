from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, SiteViewSet, UserViewSet, 
    LoginView, LogoutView, MeView, TenantResolveView, SaaSConfigView, 
    SaaSDashboardStatsView, health_check
)
from .views_saas_modules import (
    SaaSUpdateViewSet, SaaSModuleViewSet, SaaSPlansViewSet, 
    OrgModuleViewSet, SaaSClientViewSet, PublicPricingView
)

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'users', UserViewSet)
router.register(r'saas/updates', SaaSUpdateViewSet, basename='saas-updates')
router.register(r'saas/modules', SaaSModuleViewSet, basename='saas-modules')
router.register(r'saas/plans', SaaSPlansViewSet, basename='saas-plans')
router.register(r'saas/org-modules', OrgModuleViewSet, basename='saas-org-modules')
router.register(r'saas/clients', SaaSClientViewSet, basename='saas-clients')

urlpatterns = [
    path('health/', health_check),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('tenant/resolve/', TenantResolveView.as_view(), name='tenant-resolve'),
    path('saas/config/', SaaSConfigView.as_view(), name='saas-config'),
    path('saas/public-plans/', PublicPricingView.as_view(), name='public-pricing'),
    path('dashboard/saas_stats/', SaaSDashboardStatsView.as_view(), name='saas-dashboard-stats'),
    path('', include(router.urls)),
]



