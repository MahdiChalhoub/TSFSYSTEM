"""
POS Module URL Configuration
Routes for sales and purchase transactions.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.pos.views import (
    POSViewSet, PurchaseViewSet,
    SalesReturnViewSet, CreditNoteViewSet, PurchaseReturnViewSet,
    QuotationViewSet,
)

router = DefaultRouter()
router.register(r'pos', POSViewSet, basename='pos')
router.register(r'purchase', PurchaseViewSet, basename='purchase')
router.register(r'sales-returns', SalesReturnViewSet)
router.register(r'credit-notes', CreditNoteViewSet)
router.register(r'purchase-returns', PurchaseReturnViewSet)
router.register(r'quotations', QuotationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]


