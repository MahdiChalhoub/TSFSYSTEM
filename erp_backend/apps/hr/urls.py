"""
HR Module URL Configuration
Routes for employee management.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from erp.views import EmployeeViewSet

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
