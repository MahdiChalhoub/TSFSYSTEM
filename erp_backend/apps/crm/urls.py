"""
CRM Module URL Configuration
Routes for contact management.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.crm.views import ContactViewSet

router = DefaultRouter()
router.register(r'contacts', ContactViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
