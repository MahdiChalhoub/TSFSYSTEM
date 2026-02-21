"""
POS Module URL Configuration
Routes for sales and purchase transactions.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.pos.views import (
    POSViewSet, PurchaseViewSet,
    SalesReturnViewSet, CreditNoteViewSet, PurchaseReturnViewSet,
    QuotationViewSet, DeliveryZoneViewSet, DeliveryOrderViewSet,
    DiscountRuleViewSet, OrderViewSet,
    ConsignmentSettlementViewSet,
    ProductSupplierViewSet, SupplierPriceHistoryViewSet,
    PurchaseOrderViewSet, PurchaseOrderLineViewSet,
)

router = DefaultRouter()
router.register(r'pos', POSViewSet, basename='pos')
router.register(r'purchase', PurchaseViewSet, basename='purchase')
router.register(r'sales-returns', SalesReturnViewSet)
router.register(r'credit-notes', CreditNoteViewSet)
router.register(r'purchase-returns', PurchaseReturnViewSet)
router.register(r'quotations', QuotationViewSet)
router.register(r'delivery-zones', DeliveryZoneViewSet)
router.register(r'deliveries', DeliveryOrderViewSet)
router.register(r'discount-rules', DiscountRuleViewSet)
router.register(r'consignment-settlements', ConsignmentSettlementViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'sourcing', ProductSupplierViewSet, basename='sourcing')
router.register(r'supplier-pricing', SupplierPriceHistoryViewSet, basename='supplier-pricing')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-orders')
router.register(r'po-lines', PurchaseOrderLineViewSet, basename='po-lines')

urlpatterns = [
    path('', include(router.urls)),
]


