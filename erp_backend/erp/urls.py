from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrganizationViewSet, health_check

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)

urlpatterns = [
    path('health/', health_check),
    path('', include(router.urls)),
]
