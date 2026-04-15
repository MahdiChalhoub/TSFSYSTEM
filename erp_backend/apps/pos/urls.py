"""
POS Module URL Configuration
Routes for sales and purchase transactions.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.pos.views import (
    POSViewSet, PosTicketViewSet, PurchaseViewSet,
    SalesReturnViewSet, CreditNoteViewSet, PurchaseReturnViewSet,
    QuotationViewSet, DeliveryZoneViewSet, DriverViewSet, DeliveryOrderViewSet,
    DiscountRuleViewSet, OrderViewSet,
    ConsignmentSettlementViewSet,
    ProductSupplierViewSet, SupplierPriceHistoryViewSet,
    PurchaseOrderViewSet, PurchaseOrderLineViewSet,
    POSRegisterViewSet,
    POSAuditRuleViewSet, POSAuditEventViewSet,
    POSSettingsViewSet,
    ManagerAddressBookViewSet,
)
from .views.procurement_analytics_views import (
    ProcurementDashboardView, POAgingView, CycleTimesView,
    SpendBySupplierView, MonthlySpendTrendView,
    SupplierIntelligenceView, BudgetUtilizationView,
    RequisitionPipelineView
)

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
router.register(r'drivers', DriverViewSet, basename='drivers')
router.register(r'deliveries', DeliveryOrderViewSet)
router.register(r'discount-rules', DiscountRuleViewSet)
router.register(r'consignment-settlements', ConsignmentSettlementViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'sourcing', ProductSupplierViewSet, basename='sourcing')
router.register(r'supplier-pricing', SupplierPriceHistoryViewSet, basename='supplier-pricing')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-orders')
router.register(r'po-lines', PurchaseOrderLineViewSet, basename='po-lines')
router.register(r'pos-audit-rules', POSAuditRuleViewSet, basename='pos-audit-rules')
router.register(r'pos-audit-events', POSAuditEventViewSet, basename='pos-audit-events')
router.register(r'pos-settings', POSSettingsViewSet, basename='pos-settings')
router.register(r'manager-address-book', ManagerAddressBookViewSet, basename='manager-address-book')

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/procurement/dashboard/', ProcurementDashboardView.as_view()),
    path('analytics/procurement/aging/', POAgingView.as_view()),
    path('analytics/procurement/cycle-times/', CycleTimesView.as_view()),
    path('analytics/procurement/spend-by-supplier/', SpendBySupplierView.as_view()),
    path('analytics/procurement/monthly-trend/', MonthlySpendTrendView.as_view()),
    path('analytics/procurement/supplier-intelligence/', SupplierIntelligenceView.as_view()),
    path('analytics/procurement/budget-utilization/', BudgetUtilizationView.as_view()),
    path('analytics/procurement/requisition-pipeline/', RequisitionPipelineView.as_view()),
]


