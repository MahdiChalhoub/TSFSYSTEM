"""
Finance Connector Service
===========================
Declares all capabilities that the Finance module exposes.

CRITICAL: Journal posting and sequence generation are marked as `critical=True`.
If the finance module is unavailable, these operations FAIL HARD — because
posting to an unavailable ledger silently would violate accounting integrity.

Other modules use:
    connector.execute('finance.journal.post_entry', org_id=X, data={...})
    connector.require('finance.accounts.get_chart', org_id=X)
"""

import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by CapabilityRegistry during auto-discovery."""

    # ─── JOURNAL / LEDGER ────────────────────────────────────────────

    @_cap(registry, 'finance.journal.post_entry',
          description='Post a journal entry to the ledger',
          fallback_type='WRITE', critical=True, cacheable=False)
    def post_journal_entry(org_id, data=None, user=None, **kw):
        from apps.finance.services import LedgerService
        return LedgerService.create_journal_entry(
            organization_id=org_id, **(data or {}), user=user
        )

    @_cap(registry, 'finance.journal.get_entries',
          description='Get journal entries',
          cacheable=True, cache_ttl=60)
    def get_journal_entries(org_id, limit=50, **kw):
        from apps.finance.models import JournalEntry
        return list(JournalEntry.objects.filter(
            organization_id=org_id
        ).values(
            'id', 'reference', 'description', 'transaction_date',
            'status', 'total_debit', 'total_credit'
        ).order_by('-transaction_date')[:limit])

    # ─── SEQUENCES ───────────────────────────────────────────────────

    @_cap(registry, 'finance.sequences.next_value',
          description='Get next sequence number for a document type',
          fallback_type='WRITE', critical=True, cacheable=False)
    def get_next_sequence(org_id, sequence_type='', **kw):
        from apps.finance.models import TransactionSequence
        from erp.models import Organization
        org = Organization.objects.get(id=org_id)
        return TransactionSequence.next_value(org, sequence_type)

    # ─── CHART OF ACCOUNTS ──────────────────────────────────────────

    @_cap(registry, 'finance.accounts.get_chart',
          description='Get chart of accounts for organization',
          cacheable=True, cache_ttl=3600)
    def get_chart_of_accounts(org_id, **kw):
        from apps.finance.services.cache_service import FinanceCacheService
        return FinanceCacheService.get_chart_of_accounts(org_id)

    @_cap(registry, 'finance.accounts.get_by_code',
          description='Get a financial account by its code',
          cacheable=True, cache_ttl=3600)
    def get_account_by_code(org_id, code=None, **kw):
        from apps.finance.services.cache_service import FinanceCacheService
        if not code:
            return None
        return FinanceCacheService.get_account_by_code(org_id, code)

    @_cap(registry, 'finance.accounts.get_model',
          description='Get ChartOfAccount model class',
          cacheable=False, critical=False)
    def get_coa_model(org_id=0, **kw):
        from apps.finance.models import ChartOfAccount
        return ChartOfAccount

    @_cap(registry, 'finance.accounts.get_financial_account_model',
          description='Get FinancialAccount model class',
          cacheable=False, critical=False)
    def get_financial_account_model(org_id=0, **kw):
        from apps.finance.models import FinancialAccount
        return FinancialAccount

    # ─── POSTING RULES ───────────────────────────────────────────────

    @_cap(registry, 'finance.posting_rules.resolve',
          description='Resolve posting rules for an organization',
          cacheable=True, cache_ttl=300)
    def resolve_posting_rules(org_id, **kw):
        try:
            from erp.services import ConfigurationService
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
            return ConfigurationService.get_posting_rules(org)
        except Exception as e:
            logger.warning(f"Failed to resolve posting rules: {e}")
            return {}

    # ─── TAX ENGINE ──────────────────────────────────────────────────

    @_cap(registry, 'finance.tax.get_context',
          description='Get tax engine context for an organization',
          cacheable=True, cache_ttl=300)
    def get_tax_context(org_id, scope='OFFICIAL', is_export=False, **kw):
        try:
            from apps.finance.tax_calculator import TaxEngineContext
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
            ctx = TaxEngineContext.from_org(org, scope=scope, is_export=is_export)
            return {
                'vat_active': ctx.vat_active,
                'default_rate': float(ctx.default_rate) if ctx.default_rate else 0,
                'scope': ctx.scope,
            }
        except Exception:
            return None

    @_cap(registry, 'finance.tax.get_engine_context_class',
          description='Get TaxEngineContext class for direct computation',
          cacheable=False, critical=False)
    def get_tax_engine_context_class(org_id=0, **kw):
        from apps.finance.tax_calculator import TaxEngineContext
        return TaxEngineContext

    @_cap(registry, 'finance.tax.get_calculator_class',
          description='Get TaxCalculator class for purchase/sale cost resolution',
          cacheable=False, critical=False)
    def get_tax_calculator_class(org_id=0, **kw):
        from apps.finance.tax_calculator import TaxCalculator
        return TaxCalculator

    @_cap(registry, 'finance.tax.get_supplier_profile_class',
          description='Get _SupplierProfile class for counterparty tax profiling',
          cacheable=False, critical=False)
    def get_supplier_profile_class(org_id=0, **kw):
        from apps.finance.tax_calculator import _SupplierProfile
        return _SupplierProfile

    # ─── INVOICES ────────────────────────────────────────────────────

    @_cap(registry, 'finance.invoices.create',
          description='Create an invoice',
          fallback_type='WRITE', critical=True, cacheable=False)
    def create_invoice(org_id, data=None, user=None, **kw):
        try:
            from apps.finance.invoice_service import InvoiceService
            return InvoiceService.create_invoice(
                organization_id=org_id, **(data or {}), user=user
            )
        except ImportError:
            logger.error("InvoiceService not available")
            raise

    # ─── SUPPLIER BALANCE ────────────────────────────────────────────

    @_cap(registry, 'finance.supplier_balance.get',
          description='Get supplier balance',
          cacheable=True, cache_ttl=60)
    def get_supplier_balance(org_id, supplier_id=None, **kw):
        try:
            from apps.finance.payment_models import SupplierBalance
            bal = SupplierBalance.objects.filter(
                organization_id=org_id, supplier_id=supplier_id
            ).first()
            if bal:
                return {
                    'total_purchased': float(bal.total_purchased or 0),
                    'total_paid': float(bal.total_paid or 0),
                    'balance': float(bal.balance or 0),
                }
        except ImportError:
            pass
        return None

    # ─── PAYMENT GATEWAYS ────────────────────────────────────────────

    @_cap(registry, 'finance.gateways.get_stripe_service',
          description='Get StripeGatewayService class',
          cacheable=False, critical=False)
    def get_stripe_service(org_id=0, **kw):
        from apps.finance.stripe_gateway import StripeGatewayService
        return StripeGatewayService

    @_cap(registry, 'finance.gateways.get_payment_service',
          description='Get PaymentGatewayService class',
          cacheable=False, critical=False)
    def get_payment_service(org_id=0, **kw):
        from apps.finance.payment_gateway import PaymentGatewayService
        return PaymentGatewayService

    @_cap(registry, 'finance.gateways.get_config_model',
          description='Get GatewayConfig model class',
          cacheable=False, critical=False)
    def get_gateway_config_model(org_id=0, **kw):
        from apps.finance.gateway_models import GatewayConfig
        return GatewayConfig

    # ─── INVOICE MODELS ──────────────────────────────────────────────

    @_cap(registry, 'finance.invoices.get_model',
          description='Get Invoice model class',
          cacheable=False, critical=False)
    def get_invoice_model(org_id=0, **kw):
        from apps.finance.invoice_models import Invoice
        return Invoice

    @_cap(registry, 'finance.invoices.get_line_model',
          description='Get InvoiceLine model class',
          cacheable=False, critical=False)
    def get_invoice_line_model(org_id=0, **kw):
        from apps.finance.invoice_models import InvoiceLine
        return InvoiceLine

    @_cap(registry, 'finance.invoices.get_service',
          description='Get InvoiceService class',
          cacheable=False, critical=False)
    def get_invoice_service(org_id=0, **kw):
        from apps.finance.invoice_service import InvoiceService
        return InvoiceService

    # ─── LEDGER SERVICE ──────────────────────────────────────────────

    @_cap(registry, 'finance.services.get_ledger_service',
          description='Get LedgerService class',
          cacheable=False, critical=False)
    def get_ledger_service(org_id=0, **kw):
        from apps.finance.services import LedgerService
        return LedgerService

    # ─── JOURNAL ENTRY MODEL ─────────────────────────────────────────

    @_cap(registry, 'finance.journal.get_model',
          description='Get JournalEntry model class',
          cacheable=False, critical=False)
    def get_journal_entry_model(org_id=0, **kw):
        from apps.finance.models import JournalEntry
        return JournalEntry

    # ─── SEQUENCE MODEL ──────────────────────────────────────────────

    @_cap(registry, 'finance.sequences.get_model',
          description='Get TransactionSequence model class',
          cacheable=False, critical=False)
    def get_sequence_model(org_id=0, **kw):
        from apps.finance.models import TransactionSequence
        return TransactionSequence

    # ─── PAYMENT MODELS ──────────────────────────────────────────────

    @_cap(registry, 'finance.payments.get_model',
          description='Get Payment model class',
          cacheable=False, critical=False)
    def get_payment_model(org_id=0, **kw):
        from apps.finance.payment_models import Payment
        return Payment

    @_cap(registry, 'finance.payments.get_customer_balance_model',
          description='Get CustomerBalance model class',
          cacheable=False, critical=False)
    def get_customer_balance_model(org_id=0, **kw):
        from apps.finance.payment_models import CustomerBalance
        return CustomerBalance

    @_cap(registry, 'finance.payments.get_supplier_balance_model',
          description='Get SupplierBalance model class',
          cacheable=False, critical=False)
    def get_supplier_balance_model(org_id=0, **kw):
        from apps.finance.payment_models import SupplierBalance
        return SupplierBalance

    @_cap(registry, 'finance.payments.get_payment_method_model',
          description='Get PaymentMethod model class',
          cacheable=False, critical=False)
    def get_payment_method_model(org_id=0, **kw):
        from apps.finance.models import PaymentMethod
        return PaymentMethod

    @_cap(registry, 'finance.tax_rules.get_custom_model',
          description='Get CustomTaxRule model class',
          cacheable=False, critical=False)
    def get_custom_tax_rule_model(org_id=0, **kw):
        from apps.finance.models.custom_tax_rule import CustomTaxRule
        return CustomTaxRule

    # ─── FINANCIAL ACCOUNT SERVICE ───────────────────────────────────

    @_cap(registry, 'finance.services.get_financial_account_service',
          description='Get FinancialAccountService class',
          cacheable=False, critical=False)
    def get_financial_account_service(org_id=0, **kw):
        from apps.finance.services import FinancialAccountService
        return FinancialAccountService

    @_cap(registry, 'finance.accounts.get_financial_account_model',
          description='Get FinancialAccount model class',
          cacheable=False, critical=False)
    def get_financial_account_model(org_id=0, **kw):
        from apps.finance.models import FinancialAccount
        return FinancialAccount

    # ─── JOURNAL ENTRY LINE ──────────────────────────────────────────

    @_cap(registry, 'finance.journal.get_line_model',
          description='Get JournalEntryLine model class',
          cacheable=False, critical=False)
    def get_journal_entry_line_model(org_id=0, **kw):
        from apps.finance.models import JournalEntryLine
        return JournalEntryLine

    # ─── SEQUENCE SERVICE ────────────────────────────────────────────

    @_cap(registry, 'finance.services.get_sequence_service',
          description='Get SequenceService class',
          cacheable=False, critical=False)
    def get_sequence_service(org_id=0, **kw):
        from apps.finance.services import SequenceService
        return SequenceService

    # ─── FORENSIC AUDIT SERVICE ──────────────────────────────────────

    @_cap(registry, 'finance.services.get_forensic_audit_service',
          description='Get ForensicAuditService class',
          cacheable=False, critical=False)
    def get_forensic_audit_service(org_id=0, **kw):
        from apps.finance.services.audit_service import ForensicAuditService
        return ForensicAuditService

    # ─── BARCODE SERVICE ─────────────────────────────────────────────

    @_cap(registry, 'finance.services.get_barcode_service',
          description='Get BarcodeService class',
          cacheable=False, critical=False)
    def get_barcode_service(org_id=0, **kw):
        from apps.finance.services import BarcodeService
        return BarcodeService

    # ─── FNE (Fiscal Normalisation Endpoint) SERVICE ─────────────────

    @_cap(registry, 'finance.fne.get_service',
          description='Get FNEService class',
          cacheable=False, critical=False)
    def get_fne_service(org_id=0, **kw):
        from apps.finance.services.fne_service import FNEService
        return FNEService

    @_cap(registry, 'finance.fne.get_config_func',
          description='Get the get_fne_config(organization) function',
          cacheable=False, critical=False)
    def get_fne_config_func(org_id=0, **kw):
        from apps.finance.services.fne_service import get_fne_config
        return get_fne_config

    @_cap(registry, 'finance.fne.get_request_class',
          description='Get FNEInvoiceRequest class',
          cacheable=False, critical=False)
    def get_fne_request_class(org_id=0, **kw):
        from apps.finance.services.fne_service import FNEInvoiceRequest
        return FNEInvoiceRequest

    @_cap(registry, 'finance.fne.get_line_item_class',
          description='Get FNELineItem class',
          cacheable=False, critical=False)
    def get_fne_line_item_class(org_id=0, **kw):
        from apps.finance.services.fne_service import FNELineItem
        return FNELineItem

    @_cap(registry, 'finance.fne.get_build_request_func',
          description='Get build_fne_request_from_sale(sale_order, org_settings) function',
          cacheable=False, critical=False)
    def get_fne_build_request_func(org_id=0, **kw):
        from apps.finance.services.fne_service import build_fne_request_from_sale
        return build_fne_request_from_sale

    # ─── INVOICE MODELS ──────────────────────────────────────────────

    @_cap(registry, 'finance.invoice_models.get_model',
          description='Get InvoiceModel (SupplierInvoice) class',
          cacheable=False, critical=False)
    def get_invoice_model_alt(org_id=0, **kw):
        from apps.finance.invoice_models import SupplierInvoice
        return SupplierInvoice


    # ─── FISCAL YEAR MODEL ────────────────────────────────────────────

    @_cap(registry, 'finance.fiscal_year.get_model',
          description='Get FiscalYear model class',
          cacheable=False, critical=False)
    def get_fiscal_year_model(org_id=0, **kw):
        from apps.finance.models import FiscalYear
        return FiscalYear


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
