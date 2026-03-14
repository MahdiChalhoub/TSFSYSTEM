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
    OrgTaxPolicyViewSet, CounterpartyTaxProfileViewSet,
    CustomTaxRuleViewSet, TaxJurisdictionRuleViewSet,
    PostingRuleViewSet,
    VATSettlementViewSet,
    PeriodicTaxViewSet,
    VATReturnReportViewSet,
)
from apps.finance.views.bank_reconciliation_views import (
    BankStatementViewSet, ReconciliationSessionViewSet,
)
from apps.finance.views.budget_views import BudgetViewSet, BudgetLineViewSet
from apps.finance.views.financial_report_views import (
    TrialBalanceView, ProfitLossView, BalanceSheetView, CashFlowView,
    FinancialReportsDashboardView, AccountDrillDownView
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
router.register(r'org-tax-policies', OrgTaxPolicyViewSet, basename='org-tax-policy')
router.register(r'counterparty-tax-profiles', CounterpartyTaxProfileViewSet, basename='counterparty-tax-profile')
router.register(r'custom-tax-rules', CustomTaxRuleViewSet, basename='custom-tax-rule')
router.register(r'tax-jurisdiction-rules', TaxJurisdictionRuleViewSet, basename='tax-jurisdiction-rule')
router.register(r'vat-settlement', VATSettlementViewSet, basename='vat-settlement')
router.register(r'posting-rules', PostingRuleViewSet, basename='posting-rule')
router.register(r'periodic-tax', PeriodicTaxViewSet, basename='periodic-tax')
router.register(r'vat-return', VATReturnReportViewSet, basename='vat-return')
router.register(r'bank-statements', BankStatementViewSet, basename='bank-statement')
router.register(r'reconciliation-sessions', ReconciliationSessionViewSet, basename='reconciliation-session')
router.register(r'budgets', BudgetViewSet, basename='budget')
router.register(r'budget-lines', BudgetLineViewSet, basename='budget-line')

from apps.finance.views.payment_views import FlutterwaveWebhookView

urlpatterns = [
    path('', include(router.urls)),
    path('webhooks/flutterwave/', FlutterwaveWebhookView.as_view(), name='flutterwave-webhook'),
    # Financial Reports (APIView endpoints)
    path('reports/trial-balance/', TrialBalanceView.as_view(), name='trial-balance'),
    path('reports/profit-loss/', ProfitLossView.as_view(), name='profit-loss'),
    path('reports/balance-sheet/', BalanceSheetView.as_view(), name='balance-sheet'),
    path('reports/cash-flow/', CashFlowView.as_view(), name='cash-flow'),
    path('reports/dashboard/', FinancialReportsDashboardView.as_view(), name='reports-dashboard'),
    path('reports/account-drilldown/<int:account_id>/', AccountDrillDownView.as_view(), name='account-drilldown'),
]
