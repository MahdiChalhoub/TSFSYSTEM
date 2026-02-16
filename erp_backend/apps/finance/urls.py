"""
Finance Module URL Configuration
Routes for all accounting, ledger, tax, and financial management endpoints.
"""
from django.urls import path, include
from rest_framework.routers import SimpleRouter

# ViewSets live in module-level views (canonical location)
from apps.finance.views import (
    FinancialAccountViewSet, ChartOfAccountViewSet,
    FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet,
    BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet,
    TransactionSequenceViewSet, ForensicAuditLogViewSet, AuditVerificationViewSet,
    DeferredExpenseViewSet, DirectExpenseViewSet, AssetViewSet, VoucherViewSet, ProfitDistributionViewSet
)

router = SimpleRouter()
router.register(r'accounts', FinancialAccountViewSet)
router.register(r'coa', ChartOfAccountViewSet)
router.register(r'fiscal-years', FiscalYearViewSet)
router.register(r'fiscal-periods', FiscalPeriodViewSet)
router.register(r'journal', JournalEntryViewSet)
router.register(r'settings/barcode', BarcodeSettingsViewSet, basename='barcode-settings')
router.register(r'loans', LoanViewSet)
router.register(r'financial-events', FinancialEventViewSet)
router.register(r'sequences', TransactionSequenceViewSet)
router.register(r'audit-logs', ForensicAuditLogViewSet, basename='audit-log')
router.register(r'audit', AuditVerificationViewSet, basename='quantum-audit')
router.register(r'deferred-expenses', DeferredExpenseViewSet)
router.register(r'expenses', DirectExpenseViewSet)
router.register(r'assets', AssetViewSet)
router.register(r'vouchers', VoucherViewSet)
router.register(r'profit-distribution', ProfitDistributionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
