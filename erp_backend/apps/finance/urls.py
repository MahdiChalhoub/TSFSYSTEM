"""
Finance Module URL Configuration
Routes for all accounting, ledger, tax, financial management, payment gateways, and reports.
"""
from django.urls import path, include
from rest_framework.routers import SimpleRouter

# ViewSets live in module-level views (canonical location)
from apps.finance.views import (
    FinancialAccountViewSet, FinancialAccountCategoryViewSet, ChartOfAccountViewSet,
    FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet,
    BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet,
    TransactionSequenceViewSet, ForensicAuditLogViewSet, AuditVerificationViewSet,
    DeferredExpenseViewSet, DirectExpenseViewSet, AssetViewSet, VoucherViewSet, ProfitDistributionViewSet,
    TaxGroupViewSet, VATSettlementViewSet,
    PaymentViewSet, CustomerBalanceViewSet, SupplierBalanceViewSet,
    InvoiceViewSet, InvoiceLineViewSet, PaymentAllocationViewSet,
    GatewayConfigViewSet, ReportViewSet,
    EInvoiceViewSet,
    FormDefinitionViewSet, FormResponseViewSet,
    # --- Universal Tax Engine ---
    OrgTaxPolicyViewSet, CounterpartyTaxProfileViewSet,
    CustomTaxRuleViewSet, TaxJurisdictionRuleViewSet,
    CountryTaxTemplateViewSet, EInvoiceStandardViewSet,
    PostingRuleViewSet, PeriodicTaxViewSet, VATReturnReportViewSet,
    PaymentMethodViewSet,
    # --- Tax Engine Extensions ---
    WithholdingTaxRuleViewSet, BadDebtVATClaimViewSet, ImportDeclarationViewSet,
    SelfSupplyVATEventViewSet, AdvancePaymentVATViewSet,
    CreditNoteVATReversalViewSet, GiftSampleVATViewSet,
    MarginSchemeTransactionViewSet, IntraBranchVATTransferViewSet,
    ReverseChargeSelfAssessmentViewSet, VATRateChangeHistoryViewSet,
    # --- Tax Rate Categories (per-product VAT rate overrides) ---
    TaxRateCategoryViewSet,
    # --- Multi-Currency ---
    CurrencyViewSet, ExchangeRateViewSet, CurrencyRevaluationViewSet,
)

router = SimpleRouter()
# --- Core Finance ---
router.register(r'accounts', FinancialAccountViewSet)
router.register(r'account-categories', FinancialAccountCategoryViewSet, basename='financial-account-category')
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
router.register(r'payments', PaymentViewSet)
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'customer-balances', CustomerBalanceViewSet)
router.register(r'supplier-balances', SupplierBalanceViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'invoice-lines', InvoiceLineViewSet, basename='invoice-line')
router.register(r'payment-allocations', PaymentAllocationViewSet, basename='payment-allocation')
router.register(r'gateway-configs', GatewayConfigViewSet, basename='gateway-config')
router.register(r'reports', ReportViewSet, basename='report')
router.register(r'einvoice', EInvoiceViewSet, basename='einvoice')
router.register(r'form-definitions', FormDefinitionViewSet, basename='form-definition')
router.register(r'form-responses', FormResponseViewSet, basename='form-response')

# --- Tax Engine: Core ---
router.register(r'tax-groups', TaxGroupViewSet)
router.register(r'org-tax-policies', OrgTaxPolicyViewSet, basename='org-tax-policy')
router.register(r'counterparty-tax-profiles', CounterpartyTaxProfileViewSet, basename='counterparty-tax-profile')
router.register(r'custom-tax-rules', CustomTaxRuleViewSet, basename='custom-tax-rule')
router.register(r'tax-jurisdiction-rules', TaxJurisdictionRuleViewSet, basename='tax-jurisdiction-rule')
router.register(r'country-tax-templates', CountryTaxTemplateViewSet, basename='country-tax-template')
router.register(r'posting-rules', PostingRuleViewSet, basename='posting-rule')
router.register(r'einvoice-standards', EInvoiceStandardViewSet, basename='einvoice-standard')

# --- Tax Engine: VAT & Periodic ---
from apps.finance.views.collections_views import CollectionsViewSet
router.register(r'collections', CollectionsViewSet, basename='collections')
from apps.finance.views.allocation_views import AllocationWorkbenchViewSet
router.register(r'allocation', AllocationWorkbenchViewSet, basename='allocation-workbench')
from apps.finance.views.statement_views import StatementViewSet
router.register(r'statement', StatementViewSet, basename='statement')
from apps.finance.views.cash_flow_views import CashFlowForecastViewSet
router.register(r'cash-flow', CashFlowForecastViewSet, basename='cash-flow')

router.register(r'vat-settlement', VATSettlementViewSet, basename='vat-settlement')
router.register(r'vat-returns', VATReturnReportViewSet, basename='vat-return')
router.register(r'periodic-taxes', PeriodicTaxViewSet, basename='periodic-tax')

# --- Tax Engine: Extensions ---
router.register(r'withholding-tax-rules', WithholdingTaxRuleViewSet, basename='withholding-tax-rule')
router.register(r'bad-debt-vat-claims', BadDebtVATClaimViewSet, basename='bad-debt-vat-claim')
router.register(r'import-declarations', ImportDeclarationViewSet, basename='import-declaration')
router.register(r'self-supply-vat-events', SelfSupplyVATEventViewSet, basename='self-supply-vat-event')
router.register(r'advance-payment-vat', AdvancePaymentVATViewSet, basename='advance-payment-vat')
router.register(r'credit-note-vat-reversals', CreditNoteVATReversalViewSet, basename='credit-note-vat-reversal')
router.register(r'gift-sample-vat', GiftSampleVATViewSet, basename='gift-sample-vat')
router.register(r'margin-scheme-transactions', MarginSchemeTransactionViewSet, basename='margin-scheme-transaction')
router.register(r'intra-branch-vat-transfers', IntraBranchVATTransferViewSet, basename='intra-branch-vat-transfer')
router.register(r'reverse-charge-self-assessments', ReverseChargeSelfAssessmentViewSet, basename='reverse-charge-self-assessment')
router.register(r'vat-rate-change-history', VATRateChangeHistoryViewSet, basename='vat-rate-change-history')
# --- Tax Rate Categories (multi-rate VAT per product) ---
router.register(r'tax-rate-categories', TaxRateCategoryViewSet, basename='tax-rate-category')

# --- Multi-Currency ---
router.register(r'currencies', CurrencyViewSet, basename='currency')
router.register(r'exchange-rates', ExchangeRateViewSet, basename='exchange-rate')
router.register(r'currency-revaluations', CurrencyRevaluationViewSet, basename='currency-revaluation')

urlpatterns = [
    path('', include(router.urls)),
]
