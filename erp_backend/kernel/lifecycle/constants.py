from django.db import models
from django.utils.translation import gettext_lazy as _


class LifecycleStatus(models.TextChoices):
    DRAFT = 'DRAFT', _('Draft')
    SUBMITTED = 'SUBMITTED', _('Submitted')
    VERIFIED = 'VERIFIED', _('Verified')
    APPROVED = 'APPROVED', _('Approved')
    POSTED = 'POSTED', _('Posted')
    LOCKED = 'LOCKED', _('Locked')
    REJECTED = 'REJECTED', _('Rejected')
    CANCELLED = 'CANCELLED', _('Cancelled')
    REVERSED = 'REVERSED', _('Reversed')


class LifecycleAction(models.TextChoices):
    SUBMIT = 'SUBMIT', _('Submit')
    VERIFY = 'VERIFY', _('Verify')
    APPROVE = 'APPROVE', _('Approve')
    POST = 'POST', _('Post')
    LOCK = 'LOCK', _('Lock')
    REVERSE = 'REVERSE', _('Reverse')
    REJECT = 'REJECT', _('Reject')
    CANCEL = 'CANCEL', _('Cancel')
    REOPEN = 'REOPEN', _('Re-open')


class TransactionTypeCode(models.TextChoices):
    """
    Master registry of all workflow-enabled transaction types.
    Modules reference these codes — the kernel owns the lifecycle.
    """
    # ── Finance ──────────────────────────────────────────────────────────
    SALES_INVOICE    = 'SALES_INVOICE',    _('Sales Invoice')
    PURCHASE_INVOICE = 'PURCHASE_INVOICE', _('Purchase Invoice')
    CREDIT_NOTE      = 'CREDIT_NOTE',      _('Credit Note')
    DEBIT_NOTE       = 'DEBIT_NOTE',       _('Debit Note')
    PAYMENT          = 'PAYMENT',          _('Payment')
    VOUCHER          = 'VOUCHER',          _('Journal Voucher')
    JOURNAL_ENTRY    = 'JOURNAL_ENTRY',    _('Journal Entry')
    DIRECT_EXPENSE   = 'DIRECT_EXPENSE',   _('Direct Expense')

    # ── Inventory ────────────────────────────────────────────────────────
    STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT', _('Stock Adjustment')
    STOCK_TRANSFER   = 'STOCK_TRANSFER',   _('Stock Transfer')
    STOCK_MOVE       = 'STOCK_MOVE',       _('Stock Move')

    # ── Fulfillment ──────────────────────────────────────────────────────
    PICK_LIST        = 'PICK_LIST',        _('Pick List')
    PACKING_ORDER    = 'PACKING_ORDER',    _('Packing Order')
    SHIPMENT         = 'SHIPMENT',         _('Shipment')

    # ── Procurement ──────────────────────────────────────────────────────
    PURCHASE_ORDER   = 'PURCHASE_ORDER',   _('Purchase Order')

    # ── Product ──────────────────────────────────────────────────────────
    PRICE_CHANGE     = 'PRICE_CHANGE',     _('Price Change Request')


# ── Valid state transitions ──────────────────────────────────────────────
TRANSITION_RULES = {
    LifecycleStatus.DRAFT:     [LifecycleStatus.SUBMITTED, LifecycleStatus.CANCELLED],
    LifecycleStatus.SUBMITTED: [LifecycleStatus.VERIFIED, LifecycleStatus.APPROVED, LifecycleStatus.REJECTED, LifecycleStatus.CANCELLED],
    LifecycleStatus.VERIFIED:  [LifecycleStatus.APPROVED, LifecycleStatus.REJECTED, LifecycleStatus.CANCELLED],
    LifecycleStatus.APPROVED:  [LifecycleStatus.POSTED, LifecycleStatus.CANCELLED],
    LifecycleStatus.POSTED:    [LifecycleStatus.LOCKED, LifecycleStatus.REVERSED],
    LifecycleStatus.LOCKED:    [],
    LifecycleStatus.REJECTED:  [LifecycleStatus.DRAFT],
    LifecycleStatus.CANCELLED: [LifecycleStatus.DRAFT],
    LifecycleStatus.REVERSED:  [],
}
