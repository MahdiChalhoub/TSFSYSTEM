"""
Migration v2 URL Configuration
==============================
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MigrationJobViewSet

router = DefaultRouter()
router.register(r'jobs', MigrationJobViewSet, basename='migration-job')

urlpatterns = [
    path('', include(router.urls)),
]
