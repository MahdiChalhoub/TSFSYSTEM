from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from .models import (
    FinancialAccount, ChartOfAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, Loan, LoanInstallment,
    FinancialEvent, Transaction
)
from .serializers import (
    FinancialAccountSerializer, ChartOfAccountSerializer, FiscalYearSerializer,
    FiscalPeriodSerializer, JournalEntrySerializer, JournalEntryLineSerializer,
    LoanSerializer, LoanInstallmentSerializer, FinancialEventSerializer,
    TransactionSerializer
)

class FinancialAccountViewSet(TenantModelViewSet):
    queryset = FinancialAccount.objects.all()
    serializer_class = FinancialAccountSerializer

class ChartOfAccountViewSet(TenantModelViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer

class FiscalYearViewSet(TenantModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer

class FiscalPeriodViewSet(TenantModelViewSet):
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer

class JournalEntryViewSet(TenantModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer

class LoanViewSet(TenantModelViewSet):
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer

class FinancialEventViewSet(TenantModelViewSet):
    queryset = FinancialEvent.objects.all()
    serializer_class = FinancialEventSerializer

class TransactionViewSet(TenantModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
