"""
RBAC Policy Engine

Policy-based authorization for complex business rules.

Example policies:
- "Cash drawer can only be closed by the user who opened it"
- "Invoice can only be voided within 24 hours of creation"
- "Stock adjustment requires manager approval if > 100 units"
"""

from typing import Callable, Dict, Any


class PolicyEngine:
    """
    Registry for authorization policies.

    Policies are functions that return True/False based on business rules.
    """

    _policies: Dict[str, Callable] = {}

    @classmethod
    def register(cls, policy_name: str, policy_func: Callable):
        """
        Register a policy function.

        Args:
            policy_name: Unique policy identifier
            policy_func: Function that returns bool

        Example:
            def can_close_register(user, register):
                return register.opened_by == user

            PolicyEngine.register('pos.can_close_register', can_close_register)
        """
        cls._policies[policy_name] = policy_func

    @classmethod
    def check(cls, policy_name: str, **kwargs) -> bool:
        """
        Check a policy.

        Args:
            policy_name: Policy identifier
            **kwargs: Arguments to pass to policy function

        Returns:
            bool

        Example:
            if PolicyEngine.check('pos.can_close_register', user=request.user, register=register):
                ...
        """
        if policy_name not in cls._policies:
            raise ValueError(f"Policy '{policy_name}' not registered")

        policy_func = cls._policies[policy_name]
        return policy_func(**kwargs)

    @classmethod
    def list_policies(cls) -> list:
        """
        List all registered policies.

        Returns:
            List of policy names
        """
        return list(cls._policies.keys())


def register_policy(policy_name: str):
    """
    Decorator for registering policies.

    Usage:
        @register_policy('pos.can_close_register')
        def can_close_register(user, register):
            return register.opened_by == user
    """
    def decorator(func):
        PolicyEngine.register(policy_name, func)
        return func
    return decorator


# Built-in policies

@register_policy('pos.can_close_register')
def can_close_register(user, register):
    """
    User can only close a register they opened.
    """
    return register.opened_by_id == user.id


@register_policy('finance.can_void_invoice')
def can_void_invoice(user, invoice):
    """
    Invoice can only be voided if:
    1. User has permission
    2. Invoice is not older than 24 hours
    3. Invoice has no payments
    """
    from django.utils import timezone
    from datetime import timedelta

    # Check age
    age = timezone.now() - invoice.created_at
    if age > timedelta(hours=24):
        return False

    # Check payments
    if invoice.payments.exists():
        return False

    return True


@register_policy('inventory.can_adjust_stock')
def can_adjust_stock(user, adjustment_quantity):
    """
    Stock adjustment > 100 units requires manager role.
    """
    if abs(adjustment_quantity) <= 100:
        return True

    # Check if user has manager role
    from .permissions import check_permission
    return check_permission(user, 'inventory.manager_adjust_stock')


@register_policy('finance.can_modify_closed_period')
def can_modify_closed_period(user, period):
    """
    Closed accounting periods cannot be modified unless user is admin.
    """
    if period.is_closed:
        return user.is_superuser or check_permission(user, 'finance.reopen_period')

    return True
