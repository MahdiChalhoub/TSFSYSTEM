from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, SiteViewSet, UserViewSet, health_check,
    DashboardViewSet, TenantResolutionView
)
from .views_auth import login_view, logout_view, me_view

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'users', UserViewSet)
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'resolution', TenantResolutionView, basename='resolution')

urlpatterns = [
    path('health/', health_check),
    path('auth/login/', login_view, name='auth_login'),
    path('auth/logout/', logout_view, name='auth_logout'),
    path('auth/me/', me_view, name='auth_me'),
    path('', include(router.urls)),
]
