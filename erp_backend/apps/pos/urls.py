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
    PosTicketViewSet,
    POSRegisterViewSet,
    POSAuditEventViewSet, POSAuditRuleViewSet,
    POSSettingsViewSet,
    ManagerAddressBookViewSet,
)
from apps.pos.views.purchase_views import ProcurementRequestViewSet

router = DefaultRouter()
router.register(r'pos', POSViewSet, basename='pos')
router.register(r'pos-tickets', PosTicketViewSet, basename='pos-tickets')
router.register(r'pos-registers', POSRegisterViewSet, basename='pos-registers')
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
router.register(r'pos-audit-events', POSAuditEventViewSet, basename='pos-audit-events')
router.register(r'pos-audit-rules', POSAuditRuleViewSet, basename='pos-audit-rules')
router.register(r'pos-settings', POSSettingsViewSet, basename='pos-settings')
router.register(r'manager-address-book', ManagerAddressBookViewSet, basename='manager-address-book')
router.register(r'procurement-requests', ProcurementRequestViewSet, basename='procurement-requests')

from apps.pos.views.analytics_views import SalesDailySummaryListView, SalesDailyRollupView  # noqa: E402

urlpatterns = [
    path('', include(router.urls)),
    # Gap 9: Analytics pre-aggregated endpoints
    path('analytics/daily/', SalesDailySummaryListView.as_view(), name='analytics-daily'),
    path('analytics/daily/summary/', SalesDailyRollupView.as_view(), name='analytics-daily-summary'),
]
