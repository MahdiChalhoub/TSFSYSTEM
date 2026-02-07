"""
Finance Module URL Configuration
Routes for all accounting, ledger, tax, and financial management endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# ViewSets still live in erp/views.py (via re-exports from module serializers/services)
# They will be migrated to module-level views in a future phase
from erp.views import (
    FinancialAccountViewSet, ChartOfAccountViewSet,
    FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet,
    BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet,
    TransactionSequenceViewSet
)

router = DefaultRouter()
router.register(r'accounts', FinancialAccountViewSet)
router.register(r'coa', ChartOfAccountViewSet)
router.register(r'fiscal-years', FiscalYearViewSet)
router.register(r'fiscal-periods', FiscalPeriodViewSet)
router.register(r'journal', JournalEntryViewSet)
router.register(r'settings/barcode', BarcodeSettingsViewSet, basename='barcode-settings')
router.register(r'loans', LoanViewSet)
router.register(r'financial-events', FinancialEventViewSet)
router.register(r'sequences', TransactionSequenceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
