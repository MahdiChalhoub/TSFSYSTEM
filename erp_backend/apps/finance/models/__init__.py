from .coa_models import ChartOfAccount, FinancialAccount, FinancialAccountCategory
from .coa_models import NORMAL_BALANCE_MAP, ACCOUNT_CLASS_MAP, ACCOUNT_CLASS_NAMES
from .fiscal_models import FiscalYear, FiscalPeriod
from .ledger_models import JournalEntry, JournalEntryLine, PaymentMethod
from .transaction_models import Transaction, TransactionSequence
from .loan_models import Loan, LoanInstallment, FinancialEvent
from .expense_models import DeferredExpense, DirectExpense
from .asset_models import Asset, AmortizationSchedule
from .voucher_models import Voucher
from .audit_models import ProfitDistribution, ForensicAuditLog
from .tax_models import TaxGroup, BarcodeSettings
from .org_tax_policy import OrgTaxPolicy
from .counterparty_tax_profile import CounterpartyTaxProfile
from .periodic_tax_models import PeriodicTaxAccrual
from .custom_tax_rule import CustomTaxRule
from .tax_jurisdiction_rule import TaxJurisdictionRule
from .tax_account_mapping import TaxAccountMapping
from .country_tax_template import CountryTaxTemplate
from .einvoice_standard import EInvoiceStandard
from .posting_rule import PostingRule
from .posting_event import PostingEvent, PostingRuleHistory
from .contextual_posting_rule import ContextualPostingRule
from .coa_template import COATemplate, COATemplateAccount, COATemplatePostingRule, COATemplateMigrationMap, COAMigrationSession, COAMigrationAccountPlan
from .analytics import FinanceDailySummary
from apps.finance.payment_models import Payment, CustomerBalance, SupplierBalance
from apps.finance.invoice_models import Invoice, InvoiceLine
from apps.finance.zatca_config import ZATCAConfig
from apps.finance.report_models import ReportDefinition, ReportExecution
from apps.finance.gateway_models import GatewayConfig
# ── Engine Models (v2.0) ───────────────────────────────────────
from .opening_balance import OpeningBalance
# ── Tax Engine Models (pure tax rules + compliance) ─────────────
from .tax_engine_ext import (
    WithholdingTaxRule, BadDebtVATClaim,
    AdvancePaymentVAT, CreditNoteVATReversal,
    MarginSchemeTransaction, ReverseChargeSelfAssessment, VATRateChangeHistory,
    IntraBranchVATTransfer,  # deprecated — VAT fields now on StockTransferOrder
)
# ── Cross-cutting business events (moved to proper modules) ─────
from apps.inventory.models.gift_sample_models import GiftSampleEvent
from apps.inventory.models.internal_consumption_models import InternalConsumptionEvent
from apps.pos.models.import_declaration_models import ImportDeclaration
# Backward-compat aliases
GiftSampleVAT = GiftSampleEvent
SelfSupplyVATEvent = InternalConsumptionEvent
from .balance_snapshot import AccountBalanceSnapshot
from .dynamic_form import FormDefinition, FormResponse
from .reconciliation_models import ReconciliationMatch, ReconciliationLine
from .bank_reconciliation_models import BankStatement, BankStatementLine, ReconciliationSession
# ── Phase 3: Enterprise Models ─────────────────────────────────
from .currency_models import Currency, ExchangeRate, CurrencyRevaluation, CurrencyRevaluationLine
from .recurring_journal_models import RecurringJournalTemplate, RecurringJournalLine, RecurringJournalExecution
from .budget_models import Budget, BudgetLine
from .consolidation_models import (
    ConsolidationGroup, ConsolidationEntity, IntercompanyRule,
    ConsolidationRun, ConsolidationLine,
)


__all__ = [
    'ChartOfAccount', 'FinancialAccount', 'FinancialAccountCategory', 'FiscalYear', 'FiscalPeriod',
    'JournalEntry', 'JournalEntryLine', 'PaymentMethod', 'Transaction', 'TransactionSequence',
    'Loan', 'LoanInstallment', 'FinancialEvent', 'DeferredExpense', 'DirectExpense',
    'Asset', 'AmortizationSchedule', 'Voucher', 'ProfitDistribution', 'ForensicAuditLog',
    'TaxGroup', 'BarcodeSettings', 'OrgTaxPolicy', 'CounterpartyTaxProfile', 'PeriodicTaxAccrual',
    'CustomTaxRule', 'TaxJurisdictionRule', 'PostingRule', 'PostingEvent', 'PostingRuleHistory',
    'ContextualPostingRule', 'TaxAccountMapping', 'CountryTaxTemplate', 'EInvoiceStandard',
    'COATemplate', 'COATemplatePostingRule',
    'Payment', 'CustomerBalance', 'SupplierBalance',
    'Invoice', 'InvoiceLine', 'ZATCAConfig', 'ReportDefinition', 'ReportExecution',
    'GatewayConfig',
    # v2.0 Engine Models
    'OpeningBalance', 'AccountBalanceSnapshot',
    'ReconciliationMatch', 'ReconciliationLine',
    'BankStatement', 'BankStatementLine', 'ReconciliationSession',
    'NORMAL_BALANCE_MAP', 'ACCOUNT_CLASS_MAP', 'ACCOUNT_CLASS_NAMES',
    'FinanceDailySummary',
    # Phase 3: Enterprise
    'Currency', 'ExchangeRate', 'CurrencyRevaluation', 'CurrencyRevaluationLine',
    'RecurringJournalTemplate', 'RecurringJournalLine', 'RecurringJournalExecution',
    'Budget', 'BudgetLine',
    'ConsolidationGroup', 'ConsolidationEntity', 'IntercompanyRule',
    'ConsolidationRun', 'ConsolidationLine',
    # Phase 1: Tax Engine (pure tax rules + compliance)
    'WithholdingTaxRule', 'BadDebtVATClaim', 'ImportDeclaration',
    'AdvancePaymentVAT', 'CreditNoteVATReversal',
    'MarginSchemeTransaction', 'ReverseChargeSelfAssessment', 'VATRateChangeHistory',
    'IntraBranchVATTransfer',  # deprecated
    # Cross-cutting business events (moved to proper modules)
    'GiftSampleEvent', 'InternalConsumptionEvent',
    # Backward-compat aliases
    'GiftSampleVAT', 'SelfSupplyVATEvent',
]

