"""
Finance Module URL Configuration
These routes will be included by the kernel router as modules migrate.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Finance module URLs are currently served via the kernel router (erp/urls.py)
# through backward-compatible re-exports. As migration completes, ViewSets
# will be moved here with their own router registrations.
#
# Future state:
# router = DefaultRouter()
# router.register(r'coa', ChartOfAccountViewSet)
# router.register(r'accounts', FinancialAccountViewSet)
# router.register(r'fiscal-years', FiscalYearViewSet)
# router.register(r'journal', JournalEntryViewSet)
# router.register(r'loans', LoanViewSet)
# router.register(r'financial-events', FinancialEventViewSet)
# router.register(r'sequences', TransactionSequenceViewSet)
# router.register(r'settings/barcode', BarcodeSettingsViewSet, basename='barcode-settings')
#
# urlpatterns = [path('', include(router.urls))]

urlpatterns = []
