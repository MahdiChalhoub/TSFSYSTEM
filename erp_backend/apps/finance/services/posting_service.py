import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

class PaymentPostingService:
    """Manages the lifecycle of posting a Payment to the General Ledger."""

    @staticmethod
    @transaction.atomic
    def post_payment(payment, user=None):
        """
        Takes a DRAFT payment, validates its scope against linked documents,
        creates the corresponding POSTED JournalEntry, and marks the payment POSTED.
        """
        if payment.status == 'POSTED':
            return payment

        from apps.finance.services import LedgerService
        from erp.services import ConfigurationService
        from apps.finance.models import FinancialAccount

        organization = payment.organization
        rules = ConfigurationService.get_posting_rules(organization)

        # Enforce scope propagation
        if payment.invoice and payment.scope != payment.invoice.scope:
            raise ValidationError(
                f"Scope mismatch: Payment scope ({payment.scope}) must match "
                f"Invoice scope ({payment.invoice.scope})."
            )

        fin_acc = FinancialAccount.objects.filter(
            id=payment.payment_account_id, organization=organization
        ).first()
        cash_acc = fin_acc.ledger_account_id if fin_acc else None

        if not cash_acc:
            raise ValidationError("Payment GL mapping missing: Cash account not configured or linked")

        lines = []
        if payment.type == 'SUPPLIER_PAYMENT':
            ap_acc = rules.get('purchases', {}).get('payable')
            if not ap_acc:
                raise ValidationError("Payment GL mapping missing: AP account not configured")
            lines = [
                {"account_id": ap_acc, "debit": payment.amount, "credit": Decimal('0'),
                 "description": "AP reduction"},
                {"account_id": cash_acc, "debit": Decimal('0'), "credit": payment.amount,
                 "description": "Cash/Bank outflow"},
            ]
            desc_prefix = "Supplier Payment"
        elif payment.type == 'CUSTOMER_RECEIPT':
            ar_acc = rules.get('sales', {}).get('receivable')
            if not ar_acc:
                raise ValidationError("Receipt GL mapping missing: AR account not configured")
            lines = [
                {"account_id": cash_acc, "debit": payment.amount, "credit": Decimal('0'),
                 "description": "Cash/Bank inflow"},
                {"account_id": ar_acc, "debit": Decimal('0'), "credit": payment.amount,
                 "description": "AR reduction"},
            ]
            desc_prefix = "Customer Receipt"
        else:
            raise ValidationError(f"Unknown payment type: {payment.type} cannot be posted via PaymentPostingService")

        description = payment.description or payment.reference
        if not description:
            description = f"Payment {payment.id}"

        journal_entry = LedgerService.create_journal_entry(
            organization=organization,
            transaction_date=payment.payment_date,
            description=f"{desc_prefix}: {description}",
            reference=f"PAY-{payment.id}",
            status='POSTED',
            scope=payment.scope,
            user=user,
            lines=lines
        )

        payment.journal_entry = journal_entry
        payment.status = 'POSTED'
        payment.save(update_fields=['journal_entry', 'status'])
        
        logger.info(f"Successfully posted Payment {payment.id} with JournalEntry {journal_entry.id}")
        return payment
