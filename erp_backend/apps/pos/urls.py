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
    PurchaseRequisitionViewSet, SupplierQuotationViewSet,
    ThreeWayMatchResultViewSet, DisputeCaseViewSet,
    ProcurementBudgetViewSet, SupplierPerformanceViewSet,
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

# Enterprise procurement governance
router.register(r'purchase-requisitions', PurchaseRequisitionViewSet, basename='purchase-requisitions')
router.register(r'supplier-quotations', SupplierQuotationViewSet, basename='supplier-quotations')
router.register(r'three-way-match', ThreeWayMatchResultViewSet, basename='three-way-match')
router.register(r'disputes', DisputeCaseViewSet, basename='disputes')
router.register(r'procurement-budgets', ProcurementBudgetViewSet, basename='procurement-budgets')
router.register(r'supplier-performance', SupplierPerformanceViewSet, basename='supplier-performance')

from apps.pos.views.analytics_views import SalesDailySummaryListView, SalesDailyRollupView  # noqa: E402
from apps.pos.views.procurement_analytics_views import (  # noqa: E402
    ProcurementDashboardView, POAgingView, CycleTimesView,
    SpendBySupplierView, MonthlySpendTrendView, SupplierIntelligenceView,
    BudgetUtilizationView, RequisitionPipelineView,
)

urlpatterns = [
    path('', include(router.urls)),
    # Gap 9: Analytics pre-aggregated endpoints
    path('analytics/daily/', SalesDailySummaryListView.as_view(), name='analytics-daily'),
    path('analytics/daily/summary/', SalesDailyRollupView.as_view(), name='analytics-daily-summary'),
    # Phase 5: Procurement Intelligence Analytics
    path('analytics/procurement/dashboard/', ProcurementDashboardView.as_view(), name='procurement-dashboard'),
    path('analytics/procurement/aging/', POAgingView.as_view(), name='procurement-aging'),
    path('analytics/procurement/cycle-times/', CycleTimesView.as_view(), name='procurement-cycle-times'),
    path('analytics/procurement/spend-by-supplier/', SpendBySupplierView.as_view(), name='procurement-spend-by-supplier'),
    path('analytics/procurement/monthly-trend/', MonthlySpendTrendView.as_view(), name='procurement-monthly-trend'),
    path('analytics/procurement/supplier-intelligence/', SupplierIntelligenceView.as_view(), name='procurement-supplier-intelligence'),
    path('analytics/procurement/budget-utilization/', BudgetUtilizationView.as_view(), name='procurement-budget-utilization'),
    path('analytics/procurement/requisition-pipeline/', RequisitionPipelineView.as_view(), name='procurement-requisition-pipeline'),
]

