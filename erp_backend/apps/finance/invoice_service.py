"""
Invoice Service
===============
Business logic for invoice-payment integration:
- Recording payments against invoices
- Auto-status transitions (DRAFT→SENT→PARTIAL_PAID→PAID / OVERDUE)
- PaymentAllocation management
- Overdue detection
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class InvoiceService:
    """Manages invoice lifecycle and payment allocation."""

    @staticmethod
    @transaction.atomic
    def record_payment(invoice_id, amount, method, reference=None, tenant_id=None, user=None):
        """
        Public API to record a payment for an invoice by ID.
        Used by external gateways (Stripe, etc.)
        """
        from apps.finance.invoice_models import Invoice
        from apps.finance.models import FinancialAccount

        qs = Invoice.objects.filter(id=invoice_id)
        if organization_id:
            qs = qs.filter(tenant_id=organization_id)
        
        invoice = qs.first()
        if not invoice:
            raise ValidationError(f"Invoice {invoice_id} not found.")

        # Find a default payment account if not provided (e.g. 'Stripe Clearing')
        payment_account = FinancialAccount.objects.filter(
            tenant_id=invoice.organization_id,
            type='BANK'
        ).first()

        return InvoiceService.record_payment_for_invoice(
            invoice=invoice,
            amount=amount,
            method=method,
            payment_account_id=payment_account.id if payment_account else None,
            reference=reference,
            user=user
        )

    @staticmethod
    @transaction.atomic
    def allocate_payment(payment, invoice, amount, user=None):
        """
        Allocate a (partial) payment to an invoice.
        Creates a PaymentAllocation record and calls invoice.record_payment().

        Args:
            payment: Payment instance
            invoice: Invoice instance
            amount: Decimal amount to allocate
            user: User performing the allocation

        Returns:
            PaymentAllocation instance

        Raises:
            ValidationError if the amount exceeds unallocated payment or invoice balance
        """
        from apps.finance.invoice_models import PaymentAllocation

        amount = Decimal(str(amount))
        if amount <= 0:
            raise ValidationError("Allocation amount must be positive.")

        # Check: does the payment have enough unallocated funds?
        already_allocated = sum(
            a.allocated_amount for a in payment.allocations.all()
        )
        unallocated = payment.amount - already_allocated
        if amount > unallocated:
            raise ValidationError(
                f"Payment only has {unallocated} unallocated. "
                f"Cannot allocate {amount}."
            )

        # Check: don't overpay the invoice
        if amount > invoice.balance_due:
            raise ValidationError(
                f"Invoice balance is {invoice.balance_due}. "
                f"Cannot allocate {amount}."
            )

        # Create allocation record
        allocation = PaymentAllocation.objects.create(
            organization=invoice.organization,
            payment=payment,
            invoice=invoice,
            allocated_amount=amount,
        )

        # Update the invoice paid/balance fields and status
        invoice.record_payment(amount)

        # If payment.invoice is not set, link it to the first invoice
        if not payment.invoice_id:
            payment.invoice = invoice
            payment.save(update_fields=['invoice'])

        logger.info(
            f"Allocated {amount} from Payment#{payment.id} "
            f"to Invoice#{invoice.invoice_number} "
            f"(new balance: {invoice.balance_due})"
        )

        return allocation

    @staticmethod
    @transaction.atomic
    def record_payment_for_invoice(
        invoice, amount, method, payment_account_id,
        description=None, reference=None, user=None
    ):
        """
        Create a Payment and immediately allocate it to an invoice.
        This is a convenience method for the common "pay this invoice" flow.

        Returns:
            tuple (Payment, PaymentAllocation)
        """
        from apps.finance.payment_models import Payment

        amount = Decimal(str(amount))

        # Determine payment type based on invoice type
        # The Invoice model uses 'SALES' for customer invoices
        if invoice.type in ('SALES', 'SALE', 'POS'):
            payment_type = 'CUSTOMER_RECEIPT'
        elif invoice.type in ('PURCHASE', 'EXPENSE'):
            payment_type = 'SUPPLIER_PAYMENT'
        else:
            raise ValidationError(f"Unknown invoice type: {invoice.type}")

        payment = Payment.objects.create(
            organization=invoice.organization,
            type=payment_type,
            contact=invoice.contact,
            amount=amount,
            payment_date=timezone.now().date(),
            method=method,
            reference=reference or f"INV-{invoice.invoice_number}",
            description=description or f"Payment for invoice {invoice.invoice_number}",
            invoice=invoice,
            payment_account_id=payment_account_id,
            status='DRAFT',
            scope=invoice.scope,
            created_by=user,
        )

        # Allocate payment first so unallocated checks pass
        allocation = InvoiceService.allocate_payment(
            payment=payment,
            invoice=invoice,
            amount=amount,
            user=user,
        )

        # Now post the payment (this generates the JournalEntry and sets status to POSTED)
        from apps.finance.services.posting_service import PaymentPostingService
        payment = PaymentPostingService.post_payment(payment, user=user)

        return payment, allocation

    @staticmethod
    def check_overdue_invoices(organization=None):
        """
        Scan for invoices past due_date and mark them OVERDUE.
        Can be run by Celery beat or called manually.

        Args:
            organization: If provided, only check this org. Otherwise, check all.

        Returns:
            int — number of invoices marked overdue
        """
        from apps.finance.invoice_models import Invoice

        qs = Invoice.objects.filter(
            status__in=['SENT', 'PARTIAL_PAID'],
            due_date__lt=timezone.now().date(),
        )
        if organization:
            qs = qs.filter(organization=organization)

        count = 0
        for invoice in qs:
            invoice.status = 'OVERDUE'
            invoice.save(update_fields=['status'])
            count += 1
            logger.info(f"Invoice {invoice.invoice_number} marked OVERDUE")

        return count

    @staticmethod
    def get_invoice_payment_summary(invoice):
        """
        Return a summary of all payment allocations for an invoice.
        """
        from apps.finance.invoice_models import PaymentAllocation

        allocations = PaymentAllocation.objects.filter(
            invoice=invoice
        ).select_related('payment')

        return {
            'invoice_number': invoice.invoice_number,
            'total_amount': float(invoice.total_amount),
            'paid_amount': float(invoice.paid_amount),
            'balance_due': float(invoice.balance_due),
            'status': invoice.status,
            'allocations': [
                {
                    'payment_id': a.payment_id,
                    'payment_reference': a.payment.reference,
                    'payment_method': a.payment.method,
                    'allocated_amount': float(a.allocated_amount),
                    'allocated_at': a.allocated_at.isoformat() if a.allocated_at else None,
                }
                for a in allocations
            ],
        }
