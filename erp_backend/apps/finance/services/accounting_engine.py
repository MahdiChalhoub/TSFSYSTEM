"""
AccountingEngine
================
Unified service for posting business documents to the General Ledger.
Enforces OrgTaxPolicy (Phase 2) and PostingRules (Phase 3).
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError

from erp.services import ConfigurationService
from apps.finance.services.ledger_service import LedgerService
from apps.finance.tax_calculator import TaxCalculator, TaxEngineContext, _SupplierProfile
from apps.finance.services.posting_service import PaymentPostingService
from apps.finance.models.org_tax_policy import OrgTaxPolicy

logger = logging.getLogger(__name__)

class AccountingEngine:

    @staticmethod
    @transaction.atomic
    def post_purchase_invoice(invoice, user=None):
        """
        Posts a PURCHASE/EXPENSE invoice to the GL.
        Uses the comprehensive TaxCalculator engine to resolve costs and VAT.
        """
        if invoice.journal_entry:
            return invoice.journal_entry

        org = invoice.organization
        rules = ConfigurationService.get_posting_rules(org)
        
        # Resolve via PostingResolver (Tax Engine first, rules fallback)
        from apps.finance.services.posting_resolver import PostingResolver

        # Enforce scope and context
        ctx = TaxEngineContext.from_org(org, scope=invoice.scope)
        supplier_profile = _SupplierProfile.from_contact(invoice.contact)

        # Validate required accounts
        purch_rules = rules.get('purchases', {})
        payable_acc = purch_rules.get('payable')
        inventory_acc = purch_rules.get('inventory')
        vat_rec_acc = PostingResolver.resolve(org, 'purchases.vat_recoverable', required=False)

        if not payable_acc:
            raise ValidationError("Posting Rule Missing: 'purchases.payable' account not configured.")
        if not inventory_acc:
            raise ValidationError("Posting Rule Missing: 'purchases.inventory' account not configured.")

        lines = []
        total_ap = Decimal('0.00')
        total_vat_recoverable = Decimal('0.00')
        custom_liabilities_map = {}  # {account_id: Decimal amount}

        # Process invoice lines
        for inv_line in invoice.lines.all():
            ht = inv_line.line_total_ht or Decimal('0.00')
            vat_rate = (inv_line.tax_rate or Decimal('0.00')) / Decimal('100')
            
            # Use the powerful resolver from Phase 2/3 math engine
            res = TaxCalculator.resolve_purchase_costs(
                base_ht=ht,
                vat_rate=vat_rate,
                ctx=ctx,
                supplier_vat_registered=supplier_profile.vat_registered,
                supplier_reverse_charge=supplier_profile.reverse_charge
            )
            
            # Inventory/Cost side: cost_official already includes non-recoverable VAT/taxes
            lines.append({
                'account_id': inventory_acc,
                'debit': res['cost_official'],
                'credit': Decimal('0.00'),
                'description': inv_line.description or f"Purchase line: {inv_line.product.name if inv_line.product else 'Unknown'}",
                'contact_id': invoice.contact_id
            })
            
            total_vat_recoverable += res['vat_recoverable']
            total_ap += res['ap_amount']

            # Accumulate custom tax liabilities from tax_lines
            for tl in res.get('tax_lines', []):
                if tl.get('type') == 'CUSTOM' and tl.get('custom_tax_rule_id'):
                    try:
                        from apps.finance.models import CustomTaxRule
                        rule = CustomTaxRule.objects.get(id=tl['custom_tax_rule_id'])
                        if rule.liability_account_id:
                            amt = Decimal(str(tl['amount']))
                            custom_liabilities_map[rule.liability_account_id] = \
                                custom_liabilities_map.get(rule.liability_account_id, Decimal('0.00')) + amt
                    except Exception:
                        pass

        # Recoverable VAT line (if any)
        if total_vat_recoverable > 0:
            if not vat_rec_acc:
                raise ValidationError("Posting Rule Missing: 'purchases.vat_recoverable' account required for recoverable VAT.")
            lines.append({
                'account_id': vat_rec_acc,
                'debit': total_vat_recoverable,
                'credit': Decimal('0.00'),
                'description': f"Input VAT (Recoverable) - {invoice.invoice_number or invoice.id}",
                'contact_id': invoice.contact_id
            })

        # Custom Tax Liability lines (Eco Tax, Tourism Levy, etc.)
        for liab_acc_id, liab_amt in custom_liabilities_map.items():
            if liab_amt > 0:
                lines.append({
                    'account_id': liab_acc_id,
                    'debit': Decimal('0.00'),
                    'credit': liab_amt,
                    'description': f"Custom Tax Liability (Purchase) - {invoice.invoice_number or invoice.id}",
                    'contact_id': invoice.contact_id
                })

        # Credit side: Accounts Payable (net of AIRSI if any, per resolver)
        lines.append({
            'account_id': payable_acc,
            'debit': Decimal('0.00'),
            'credit': total_ap,
            'description': f"Purchase Invoice: {invoice.invoice_number or invoice.id}",
            'contact_id': invoice.contact_id
        })

        # Create the Journal Entry
        journal_entry = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=invoice.issue_date,
            description=f"Purchase: {invoice.invoice_number or invoice.id}",
            reference=f"INV-{invoice.id}",
            status='POSTED',
            scope=invoice.scope,
            user=user,
            lines=lines
        )

        invoice.journal_entry = journal_entry
        invoice.status = 'POSTED'
        invoice.save(update_fields=['journal_entry', 'status'])


        return journal_entry

    @staticmethod
    @transaction.atomic
    def post_sales_invoice(invoice, user=None):
        """
        Posts a SALES/POS invoice to the GL.
        Uses calculate_sales_breakdown to enforce internal_sales_vat_mode.
        """
        if invoice.journal_entry:
            return invoice.journal_entry

        org = invoice.organization
        rules = ConfigurationService.get_posting_rules(org)
        ctx = TaxEngineContext.from_org(org, scope=invoice.scope)
        
        from apps.finance.services.posting_resolver import PostingResolver
        # Validate required accounts
        sales_rules = rules.get('sales', {})
        receivable_acc = sales_rules.get('receivable')
        revenue_acc = sales_rules.get('revenue')
        vat_coll_acc = PostingResolver.resolve(org, 'sales.vat_collected', required=False)

        if not receivable_acc:
            raise ValidationError("Posting Rule Missing: 'sales.receivable' account not configured.")
        if not revenue_acc:
            raise ValidationError("Posting Rule Missing: 'sales.revenue' account not configured.")

        lines = []
        total_ledger_ar = Decimal('0.00')
        total_statutory_vat = Decimal('0.00')
        total_custom_tax = Decimal('0.00')
        custom_liabilities_map = {}  # {account_id: Decimal amount}

        # Process invoice lines
        for inv_line in invoice.lines.all():
            ht = inv_line.line_total_ht or Decimal('0.00')
            vat_rate = (inv_line.tax_rate or Decimal('0.00')) / Decimal('100')
            
            res = TaxCalculator.calculate_sales_breakdown(
                base_ht=ht,
                vat_rate=vat_rate,
                ctx=ctx
            )
            
            # Revenue side
            lines.append({
                'account_id': revenue_acc,
                'debit': Decimal('0.00'),
                'credit': res['ledger_amount'],
                'description': inv_line.description or f"Sales line: {inv_line.product.name if inv_line.product else 'Unknown'}",
                'contact_id': invoice.contact_id
            })
            
            total_statutory_vat += res['statutory_vat']
            total_custom_tax += res.get('custom_tax_total', Decimal('0.00'))
            # AR side matches revenue + VAT + custom taxes
            total_ledger_ar += (res['ledger_amount'] + res['statutory_vat'] + res.get('custom_tax_total', Decimal('0.00')))

            # Accumulate custom tax liabilities for GL posting
            for liab_acc_id, liab_amt in res.get('custom_liabilities', {}).items():
                custom_liabilities_map[liab_acc_id] = custom_liabilities_map.get(liab_acc_id, Decimal('0.00')) + liab_amt

        # Statutory VAT line (liability)
        if total_statutory_vat > 0:
            if not vat_coll_acc:
                raise ValidationError("Posting Rule Missing: 'sales.vat_collected' account required for statutory VAT.")
            lines.append({
                'account_id': vat_coll_acc,
                'debit': Decimal('0.00'),
                'credit': total_statutory_vat,
                'description': f"Output VAT (Collected) - {invoice.invoice_number or invoice.id}",
                'contact_id': invoice.contact_id
            })

        # Custom Tax Liability lines (Eco Tax, Tourism Levy, etc.)
        for liab_acc_id, liab_amt in custom_liabilities_map.items():
            if liab_amt > 0:
                lines.append({
                    'account_id': liab_acc_id,
                    'debit': Decimal('0.00'),
                    'credit': liab_amt,
                    'description': f"Custom Tax Liability - {invoice.invoice_number or invoice.id}",
                    'contact_id': invoice.contact_id
                })

        # Debit side: Accounts Receivable
        lines.append({
            'account_id': receivable_acc,
            'debit': total_ledger_ar,
            'credit': Decimal('0.00'),
            'description': f"Sales Invoice: {invoice.invoice_number or invoice.id}",
            'contact_id': invoice.contact_id
        })

        # Create the Journal Entry
        journal_entry = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=invoice.issue_date,
            description=f"Sales: {invoice.invoice_number or invoice.id}",
            reference=f"INV-{invoice.id}",
            status='POSTED',
            scope=invoice.scope,
            user=user,
            lines=lines
        )

        invoice.journal_entry = journal_entry
        invoice.status = 'POSTED'
        invoice.save(update_fields=['journal_entry', 'status'])

        return journal_entry

    @staticmethod
    def post_payment(payment, user=None):
        """Delegates to existing specialist service."""
        return PaymentPostingService.post_payment(payment, user=user)
