"""
Core Policies — Enterprise Business Rule Engine
=================================================
Registers all production business policies using the Kernel PolicyEngine.

These policies are loaded at startup via core/apps.py ready() and are
available system-wide via:

    from kernel.rbac import PolicyEngine
    PolicyEngine.check('policy_name', user=..., context=...)

Architecture ref: kernel/rbac/policies.py
"""

from kernel.rbac.policies import register_policy
from kernel.config import get_config
import logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# FINANCE POLICIES
# ═══════════════════════════════════════════════════════════════════════════════

@register_policy('finance.can_approve_payment')
def can_approve_payment(user, payment_amount=0, **kwargs):
    """
    Payments above a configurable threshold require manager approval.
    Threshold is per-tenant via get_config().
    """
    threshold = get_config('finance.payment_approval_threshold', default=500000)
    if payment_amount <= threshold:
        return True
    # Large payment — check for elevated permission
    return getattr(user, 'is_superuser', False) or _has_perm(user, 'finance.approve_large_payment')


@register_policy('finance.can_void_invoice')
def can_void_invoice_policy(user, invoice=None, **kwargs):
    """
    Invoice can only be voided if:
    1. Within configurable time window (default: 72 hours)
    2. Has no applied payments
    3. User has void permission
    """
    from django.utils import timezone
    from datetime import timedelta

    if not invoice:
        return False

    max_hours = get_config('finance.invoice_void_window_hours', default=72)
    age = timezone.now() - invoice.created_at
    if age > timedelta(hours=max_hours):
        return False

    if hasattr(invoice, 'payments') and invoice.payments.exists():
        return False

    return _has_perm(user, 'finance.void_invoice')


@register_policy('finance.can_modify_closed_period')
def can_modify_closed_period_policy(user, period=None, **kwargs):
    """Closed accounting periods require admin or explicit reopen permission."""
    if not period or not getattr(period, 'is_closed', False):
        return True
    return getattr(user, 'is_superuser', False) or _has_perm(user, 'finance.reopen_period')


# ═══════════════════════════════════════════════════════════════════════════════
# POS POLICIES
# ═══════════════════════════════════════════════════════════════════════════════

@register_policy('pos.can_apply_discount')
def can_apply_discount(user, discount_pct=0, **kwargs):
    """
    Discount percentage limit is configurable per tenant.
    Exceeding the limit requires override permission.
    """
    max_discount = get_config('pos.max_discount_percent', default=20)
    if discount_pct <= max_discount:
        return True
    return _has_perm(user, 'pos.override_discount')


@register_policy('pos.can_close_register')
def can_close_register_policy(user, register=None, **kwargs):
    """User can only close a register they opened (unless they have manager override)."""
    if not register:
        return False
    if getattr(register, 'opened_by_id', None) == user.id:
        return True
    return _has_perm(user, 'pos.close_any_register')


@register_policy('pos.can_process_refund')
def can_process_refund(user, refund_amount=0, **kwargs):
    """
    Refunds above a configurable limit require manager approval.
    """
    threshold = get_config('pos.refund_approval_threshold', default=100000)
    if refund_amount <= threshold:
        return _has_perm(user, 'pos.process_refund')
    return _has_perm(user, 'pos.approve_large_refund')


# ═══════════════════════════════════════════════════════════════════════════════
# INVENTORY POLICIES
# ═══════════════════════════════════════════════════════════════════════════════

@register_policy('inventory.can_adjust_stock')
def can_adjust_stock_policy(user, adjustment_quantity=0, adjustment_value=0, **kwargs):
    """
    Stock adjustments above configurable thresholds require manager approval.
    Both quantity and value thresholds are checked.
    """
    qty_threshold = get_config('inventory.adjustment_qty_threshold', default=100)
    val_threshold = get_config('inventory.adjustment_value_threshold', default=500000)

    if abs(adjustment_quantity) <= qty_threshold and abs(adjustment_value) <= val_threshold:
        return True
    return _has_perm(user, 'inventory.approve_large_adjustment')


@register_policy('inventory.can_approve_transfer')
def can_approve_transfer(user, transfer_value=0, **kwargs):
    """
    Inter-warehouse transfers above a configurable value require manager sign-off.
    """
    threshold = get_config('inventory.transfer_approval_threshold', default=1000000)
    if transfer_value <= threshold:
        return True
    return _has_perm(user, 'inventory.approve_large_transfer')


# ═══════════════════════════════════════════════════════════════════════════════
# CRM POLICIES
# ═══════════════════════════════════════════════════════════════════════════════

@register_policy('crm.can_extend_credit')
def can_extend_credit(user, contact=None, requested_limit=0, **kwargs):
    """
    Credit limit changes above a configurable threshold require approval.
    """
    max_self_serve = get_config('crm.credit_limit_self_serve_max', default=1000000)
    if requested_limit <= max_self_serve:
        return True
    return _has_perm(user, 'crm.approve_large_credit')


@register_policy('crm.can_delete_contact')
def can_delete_contact(user, contact=None, **kwargs):
    """
    Contacts with linked financial transactions cannot be deleted,
    only archived (status=INACTIVE).
    """
    if contact and getattr(contact, 'linked_account_id', None):
        return False  # Cannot delete — has linked finance account
    return _has_perm(user, 'crm.delete_contact')


# ═══════════════════════════════════════════════════════════════════════════════
# HR POLICIES
# ═══════════════════════════════════════════════════════════════════════════════

@register_policy('hr.can_approve_leave')
def can_approve_leave(user, employee=None, leave_days=0, **kwargs):
    """
    Leave requests above a configurable threshold require department head approval.
    """
    max_days = get_config('hr.leave_auto_approve_days', default=3)
    if leave_days <= max_days:
        return _has_perm(user, 'hr.approve_leave')
    return _has_perm(user, 'hr.approve_extended_leave')


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def _has_perm(user, perm_code):
    """Safe permission check — returns False if user has no permission system."""
    if not user or not hasattr(user, 'has_perm'):
        return False
    try:
        return user.has_perm(perm_code) or getattr(user, 'is_superuser', False)
    except Exception:
        return getattr(user, 'is_superuser', False)


def register_all_policies():
    """
    Called from core/apps.py ready() to ensure all policies are loaded.
    The @register_policy decorators above execute at import time,
    so this function just needs to trigger the import.
    """
    from kernel.rbac import PolicyEngine
    count = len(PolicyEngine.list_policies())
    logger.info(f"✅ PolicyEngine: {count} policies registered")
    return count
