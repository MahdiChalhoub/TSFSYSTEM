"""
POS Module URL Configuration
Routes for sales and purchase transactions.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from erp.views import POSViewSet, PurchaseViewSet

router = DefaultRouter()
router.register(r'pos', POSViewSet, basename='pos')
router.register(r'purchase', PurchaseViewSet, basename='purchase')

urlpatterns = [
    path('', include(router.urls)),
]
