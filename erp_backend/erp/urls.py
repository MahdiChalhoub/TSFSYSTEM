from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, SiteViewSet, UserViewSet, health_check
)

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    path('health/', health_check),
    path('', include(router.urls)),
]
