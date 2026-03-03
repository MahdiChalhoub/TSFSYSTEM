"""
SalesPaymentLeg — Gap 5 (Payment Reconciliation Layer)
=======================================================
A per-payment-leg record linked to each Order.

Each leg represents one atomic payment instrument used
to settle the order (e.g., CASH 50,000 + WAVE 30,000).

Reconciliation lifecycle:
  POSTED → RECONCILED  (matched to a bank statement line)
  POSTED → WRITTEN_OFF (allowable shortfall written off by authority)

Used by PaymentReconciliationService to:
  1. Persist each leg at checkout time
  2. Match legs against bank/mobile statements
  3. Track write-offs and overpayment credits
"""
from decimal import Decimal
from django.db import models
from erp.models import TenantModel, User


class SalesPaymentLeg(TenantModel):

    PAYMENT_METHODS = (
        ('CASH',         'Cash'),
        ('WAVE',         'Wave'),
        ('ORANGE_MONEY', 'Orange Money'),
        ('MTN_MOBILE',   'MTN Mobile Money'),
        ('MOBILE',       'Mobile Money (generic)'),
        ('BANK',         'Bank Transfer'),
        ('CREDIT',       'Credit / A/R'),
        ('REWARD_POINTS','Loyalty Points'),
        ('WALLET_DEBIT', 'Wallet Debit'),
        ('ROUND_OFF',    'Rounding Adjustment'),
        ('OTHER',        'Other'),
    )

    STATUS = (
        ('POSTED',       'Posted — not yet reconciled'),
        ('RECONCILED',   'Reconciled — matched to statement'),
        ('WRITTEN_OFF',  'Written Off — approved shortfall'),
        ('REFUNDED',     'Refunded — money returned to customer'),
    )

    # ── Core link ─────────────────────────────────────────────────────────────
    order          = models.ForeignKey(
        'pos.Order', on_delete=models.CASCADE,
        related_name='payment_legs'
    )

    # ── Leg fields ────────────────────────────────────────────────────────────
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    amount         = models.DecimalField(max_digits=15, decimal_places=2)
    status         = models.CharField(max_length=12, choices=STATUS, default='POSTED', db_index=True)

    # External identifier (Wave transaction ID, bank reference, etc.)
    reference      = models.CharField(max_length=200, null=True, blank=True, db_index=True)

    # Linked GL account (mirrors what was debited in the JE)
    ledger_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL,
        null=True, blank=True
    )

    # Linked JE (the checkout journal entry)
    journal_entry  = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='payment_legs'
    )

    # ── Reconciliation tracking ────────────────────────────────────────────────
    write_off      = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                         help_text='Portion written off (approved shortfall)')
    write_off_reason = models.TextField(null=True, blank=True)
    reconciled_at  = models.DateTimeField(null=True, blank=True)
    reconciled_by  = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reconciled_payment_legs'
    )

    # ── Audit ─────────────────────────────────────────────────────────────────
    posted_by      = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='posted_payment_legs'
    )
    created_at     = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at     = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'sales_payment_leg'
        indexes  = [
            models.Index(fields=['order', 'status']),
            models.Index(fields=['organization', 'payment_method', 'status']),
            models.Index(fields=['reference']),
        ]
        ordering = ['created_at']

    def __str__(self):
        return f"{self.payment_method} {self.amount} [{self.status}] — Order #{self.order_id}"

    @property
    def net_amount(self) -> Decimal:
        """Amount after write-off."""
        return self.amount - self.write_off

    @property
    def is_settled(self) -> bool:
        return self.status in ('RECONCILED', 'WRITTEN_OFF', 'REFUNDED')
