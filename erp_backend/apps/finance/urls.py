from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FinancialAccountViewSet, ChartOfAccountViewSet, FiscalYearViewSet,
    FiscalPeriodViewSet, JournalEntryViewSet, LoanViewSet,
    FinancialEventViewSet, TransactionViewSet
)

router = DefaultRouter()
router.register(r'accounts', FinancialAccountViewSet, basename='financial-account')
router.register(r'coa', ChartOfAccountViewSet, basename='chart-of-account')
router.register(r'fiscal-years', FiscalYearViewSet, basename='fiscal-year')
router.register(r'fiscal-periods', FiscalPeriodViewSet, basename='fiscal-period')
router.register(r'journal', JournalEntryViewSet, basename='journal-entry')
router.register(r'loans', LoanViewSet, basename='loan')
router.register(r'financial-events', FinancialEventViewSet, basename='financial-event')
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    path('', include(router.urls)),
]
