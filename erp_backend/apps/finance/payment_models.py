"""
Payment Models
==============
Payment, CustomerBalance, and SupplierBalance for managing
accounts receivable/payable and cash-basis VAT release.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, VerifiableModel


# =============================================================================
# PAYMENTS
# =============================================================================

class Payment(VerifiableModel):
    """
    Universal payment record for supplier payments, customer receipts, and refunds.
    Each payment posts a GL entry and optionally triggers cash-basis VAT release.
    """
    TYPE_CHOICES = (
        ('SUPPLIER_PAYMENT', 'Supplier Payment'),
        ('CUSTOMER_RECEIPT', 'Customer Receipt'),
        ('REFUND', 'Refund'),
    )
    METHOD_CHOICES = (
        ('CASH', 'Cash'),
        ('BANK', 'Bank Transfer'),
        ('CHECK', 'Check'),
        ('CARD', 'Card'),
        ('OTHER', 'Other'),
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('CANCELLED', 'Cancelled'),
    )

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    contact = models.ForeignKey('crm.Contact', on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    payment_date = models.DateField()
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='CASH')
    reference = models.CharField(max_length=100, null=True, blank=True, help_text='Auto-generated payment reference')
    description = models.TextField(null=True, blank=True)

    # Link to source document (optional)
    supplier_invoice = models.ForeignKey(
        'pos.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments_made', help_text='Linked purchase order'
    )
    sales_order = models.ForeignKey(
        'pos.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments_received', help_text='Linked sales order'
    )
    credit_note = models.ForeignKey(
        'pos.CreditNote', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments', help_text='Linked credit note (for refunds)'
    )

    # Payment account (Cash drawer, Bank account)
    payment_account = models.ForeignKey(
        'finance.FinancialAccount', on_delete=models.PROTECT,
        related_name='payments', help_text='Account used for payment'
    )

    # GL
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments'
    )
    invoice = models.ForeignKey(
        'finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='direct_payments', help_text='Primary invoice this payment applies to'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    scope = models.CharField(max_length=20, default='OFFICIAL')

    # Audit
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'payment'
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"PAY-{self.id} ({self.type}: {self.amount})"


# =============================================================================
# RUNNING BALANCES
# =============================================================================

class CustomerBalance(TenantModel):
    """
    Running accounts receivable balance per customer.
    Updated by PaymentService when receipts are recorded.
    """
    contact = models.OneToOneField(
        'crm.Contact', on_delete=models.CASCADE, related_name='customer_balance'
    )
    current_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                          help_text='Positive = they owe us')
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    last_payment_date = models.DateField(null=True, blank=True)
    last_invoice_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_balance'

    def __str__(self):
        return f"AR: {self.contact} = {self.current_balance}"


class SupplierBalance(TenantModel):
    """
    Running accounts payable balance per supplier.
    Updated by PaymentService when payments are recorded.
    """
    contact = models.OneToOneField(
        'crm.Contact', on_delete=models.CASCADE, related_name='supplier_balance'
    )
    current_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                          help_text='Positive = we owe them')
    last_payment_date = models.DateField(null=True, blank=True)
    last_invoice_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'supplier_balance'

    def __str__(self):
        return f"AP: {self.contact} = {self.current_balance}"
