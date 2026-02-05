from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, SiteViewSet, UserViewSet, 
    LoginView, LogoutView, MeView, TenantResolveView, SaaSConfigView, 
    SaaSDashboardStatsView, SaaSPlansView, SaaSModulesView, health_check
)

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    path('health/', health_check),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('tenant/resolve/', TenantResolveView.as_view(), name='tenant-resolve'),
    path('saas/config/', SaaSConfigView.as_view(), name='saas-config'),
    path('saas/plans/', SaaSPlansView.as_view(), name='saas-plans'),
    path('saas/modules/', SaaSModulesView.as_view(), name='saas-modules'),
    path('dashboard/saas_stats/', SaaSDashboardStatsView.as_view(), name='saas-dashboard-stats'),
    path('', include(router.urls)),
]



