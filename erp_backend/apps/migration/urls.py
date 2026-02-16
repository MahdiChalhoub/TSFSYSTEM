"""
URL routing for the Migration module.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.migration.views import MigrationViewSet

router = DefaultRouter()
router.register(r'jobs', MigrationViewSet, basename='migration-job')

urlpatterns = [
    path('', include(router.urls)),
]
