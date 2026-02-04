from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.finance.views import (
    FinancialAccountViewSet, ChartOfAccountViewSet, 
    FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet
)

router = DefaultRouter()
router.register(r'accounts', FinancialAccountViewSet)
router.register(r'coa', ChartOfAccountViewSet)
router.register(r'fiscal-years', FiscalYearViewSet)
router.register(r'fiscal-periods', FiscalPeriodViewSet)
router.register(r'journal', JournalEntryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
