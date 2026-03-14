import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

class InvoicePostingService:
    """Manages GL posting for Invoice documents."""

    @staticmethod
    @transaction.atomic
    def post_invoice(invoice, user=None):
        """
        Generates JournalEntry for a SALES or PURCHASE invoice.
        Standardizes on double-entry accounting per OrgTaxPolicy.
        """
        if invoice.status == 'POSTED':
            return invoice

        from apps.finance.services import LedgerService
        from erp.services import ConfigurationService

        organization = invoice.organization
        rules = ConfigurationService.get_posting_rules(organization)

        # Resolve VAT accounts via PostingResolver (Tax Engine first, rules fallback)
        from apps.finance.services.posting_resolver import PostingResolver
        
        # Determine accounts from rules
        lines = []
        if invoice.type == 'SALES':
            ar_acc = rules.get('sales', {}).get('receivable')
            income_acc = rules.get('sales', {}).get('revenue') or rules.get('sales', {}).get('income')
            tax_acc = PostingResolver.resolve(organization, 'sales.vat_collected', required=False) or rules.get('sales', {}).get('tax')
            
            if not all([ar_acc, income_acc]):
                raise ValidationError("Invoice GL mapping missing: Sales accounts not configured")
            
            # Line 1: AR (Debit)
            lines.append({
                "account_id": ar_acc,
                "debit": invoice.total_amount,
                "credit": Decimal('0'),
                "description": f"AR: {invoice.contact_name}"
            })
            
            # Line 2: Income (Credit)
            lines.append({
                "account_id": income_acc,
                "debit": Decimal('0'),
                "credit": invoice.subtotal_ht,
                "description": "Sales Revenue"
            })
            
            # Line 3: Tax (Credit)
            if invoice.tax_amount > 0:
                if not tax_acc:
                    raise ValidationError("Invoice GL mapping missing: Sales Tax account not configured")
                lines.append({
                    "account_id": tax_acc,
                    "debit": Decimal('0'),
                    "credit": invoice.tax_amount,
                    "description": "VAT Output"
                })
            
            desc_prefix = "Sales Invoice"

        elif invoice.type == 'PURCHASE':
            ap_acc = rules.get('purchases', {}).get('payable')
            expense_acc = rules.get('purchases', {}).get('expense')
            tax_acc = PostingResolver.resolve(organization, 'purchases.vat_recoverable', required=False) or rules.get('purchases', {}).get('tax') # VAT Input
            
            if not all([ap_acc, expense_acc]):
                raise ValidationError("Invoice GL mapping missing: Purchase accounts not configured")
                
            # Line 1: Expense (Debit)
            lines.append({
                "account_id": expense_acc,
                "debit": invoice.subtotal_ht,
                "credit": Decimal('0'),
                "description": "Purchase Expense"
            })
            
            # Line 2: Tax (Debit)
            if invoice.tax_amount > 0:
                if not tax_acc:
                    raise ValidationError("Invoice GL mapping missing: Purchase Tax account not configured")
                lines.append({
                    "account_id": tax_acc,
                    "debit": invoice.tax_amount,
                    "credit": Decimal('0'),
                    "description": "VAT Input"
                })
                
            # Line 3: AP (Credit)
            lines.append({
                "account_id": ap_acc,
                "debit": Decimal('0'),
                "credit": invoice.total_amount,
                "description": f"AP: {invoice.contact_name}"
            })
            
            desc_prefix = "Purchase Invoice"
        else:
            raise ValidationError(f"Posting for {invoice.type} is not yet implemented.")

        # Create Journal Entry
        journal_entry = LedgerService.create_journal_entry(
            organization=organization,
            transaction_date=invoice.issue_date,
            description=f"{desc_prefix}: {invoice.invoice_number or invoice.id}",
            reference=f"INV-{invoice.id}",
            status='POSTED',
            scope=invoice.scope,
            user=user,
            lines=lines
        )

        invoice.journal_entry = journal_entry
        invoice.save(update_fields=['journal_entry'])
        return journal_entry
