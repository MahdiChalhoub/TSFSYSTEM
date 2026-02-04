from django.contrib import admin
from .models import (
    FiscalYear, FiscalPeriod, FinancialAccount, ChartOfAccount,
    JournalEntry, JournalEntryLine, FinancialEvent, Loan, LoanInstallment, Transaction
)

@admin.register(FiscalYear)
class FiscalYearAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date', 'is_closed', 'organization')
    list_filter = ('organization', 'is_closed')
    search_fields = ('name',)

@admin.register(FiscalPeriod)
class FiscalPeriodAdmin(admin.ModelAdmin):
    list_display = ('name', 'fiscal_year', 'start_date', 'end_date')
    list_filter = ('fiscal_year',)
    ordering = ('fiscal_year', 'start_date')

@admin.register(ChartOfAccount)
class ChartOfAccountAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'type', 'sub_type', 'organization', 'is_active')
    list_filter = ('organization', 'type', 'is_active')
    search_fields = ('code', 'name')

@admin.register(FinancialAccount)
class FinancialAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'balance', 'site', 'organization')
    list_filter = ('organization', 'site')

@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ('reference', 'transaction_date', 'description', 'site', 'status')
    list_filter = ('site', 'status', 'transaction_date')
    search_fields = ('reference', 'description')

@admin.register(JournalEntryLine)
class JournalEntryLineAdmin(admin.ModelAdmin):
    list_display = ('journal_entry', 'account', 'debit', 'credit', 'description')

@admin.register(FinancialEvent)
class FinancialEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'amount', 'status', 'reference', 'organization')
    list_filter = ('event_type', 'status')

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('reference_id', 'type', 'amount', 'scope', 'created_at')
    list_filter = ('type', 'scope')

@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ('contact', 'principal_amount', 'status', 'start_date')
    list_filter = ('status',)

@admin.register(LoanInstallment)
class LoanInstallmentAdmin(admin.ModelAdmin):
    list_display = ('loan', 'due_date', 'total_amount', 'status')
