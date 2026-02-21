"""
Finance Module URL Configuration
Routes for all accounting, ledger, tax, financial management, payment gateways, and reports.
"""
from django.urls import path, include
from rest_framework.routers import SimpleRouter

# ViewSets live in module-level views (canonical location)
from apps.finance.views import (
    FinancialAccountViewSet, ChartOfAccountViewSet,
    FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet,
    BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet,
    TransactionSequenceViewSet, ForensicAuditLogViewSet, AuditVerificationViewSet,
    DeferredExpenseViewSet, DirectExpenseViewSet, AssetViewSet, VoucherViewSet, ProfitDistributionViewSet,
    TaxGroupViewSet, PaymentViewSet, CustomerBalanceViewSet, SupplierBalanceViewSet,
    InvoiceViewSet, InvoiceLineViewSet, PaymentAllocationViewSet,
    GatewayConfigViewSet, ReportViewSet,
    EInvoiceViewSet,
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
router.register(r'tax-groups', TaxGroupViewSet)
router.register(r'payments', PaymentViewSet)
router.register(r'customer-balances', CustomerBalanceViewSet)
router.register(r'supplier-balances', SupplierBalanceViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'invoice-lines', InvoiceLineViewSet, basename='invoice-line')
router.register(r'payment-allocations', PaymentAllocationViewSet, basename='payment-allocation')
router.register(r'gateway-configs', GatewayConfigViewSet, basename='gateway-config')
router.register(r'reports', ReportViewSet, basename='report')
router.register(r'einvoice', EInvoiceViewSet, basename='einvoice')

urlpatterns = [
    path('', include(router.urls)),
]
