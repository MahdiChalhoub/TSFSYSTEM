"""
SalesPermissionService — Gap 7 (ERP Roadmap)
=============================================
Enforces role-based access control for sales workflow actions.

Uses the existing erp.Role → erp.Permission infrastructure.
Each permission is identified by a code string (e.g. 'sales.confirm_order').

No new DB models needed — seeds permissions via ensure_sales_permissions()
and wires checks into workflow views / POS checkout.

Permission Codes (all prefixed sales.*)
──────────────────────────────────────
  sales.confirm_order       — Confirm a DRAFT order
  sales.cancel_order        — Cancel a CONFIRMED/PROCESSING order
  sales.mark_delivered      — Record delivery
  sales.mark_paid           — Record payment / mark as paid
  sales.write_off           — Write off an outstanding balance
  sales.generate_invoice    — Generate a customer invoice
  sales.apply_discount      — Apply any line-level discount
  sales.apply_discount_5    — Apply discount up to 5 %
  sales.apply_discount_15   — Apply discount up to 15 %
  sales.apply_discount_any  — Apply unlimited discount (manager+)
  sales.view_cost_price     — View cost price / COGS data
  sales.delete_order        — Permanently delete an order
  sales.override_price      — Override unit selling price

Bootstrap Roles
───────────────
  SALES_CLERK   — pos flows, no override, max 5 % discount
  SALES_MANAGER — full flow, up to 15 %, view costs
  ACCOUNTANT    — view-only + mark_paid + generate_invoice
  ADMIN         — all permissions
"""

# ─── Permission Code Catalogue ───────────────────────────────────────────────

SALES_PERMISSION_CODES: dict[str, str] = {
    'sales.confirm_order':      'Confirm a draft order',
    'sales.cancel_order':       'Cancel an open order',
    'sales.mark_delivered':     'Mark an order as delivered',
    'sales.mark_paid':          'Record a payment on an order',
    'sales.write_off':          'Write off an unpaid balance',
    'sales.generate_invoice':   'Generate a customer-facing invoice',
    'sales.apply_discount_5':   'Apply discount up to 5 %',
    'sales.apply_discount_15':  'Apply discount up to 15 %',
    'sales.apply_discount_any': 'Apply any discount (unlimited)',
    'sales.view_cost_price':    'View COGS / cost price data',
    'sales.delete_order':       'Delete an order permanently',
    'sales.override_price':     'Override the selling unit price',
}

# ─── Bootstrap Role Definitions ──────────────────────────────────────────────

BOOTSTRAP_ROLES: dict[str, list[str]] = {
    'SALES_CLERK': [
        'sales.confirm_order',
        'sales.mark_delivered',
        'sales.apply_discount_5',
    ],
    'SALES_MANAGER': [
        'sales.confirm_order',
        'sales.cancel_order',
        'sales.mark_delivered',
        'sales.mark_paid',
        'sales.write_off',
        'sales.generate_invoice',
        'sales.apply_discount_15',
        'sales.view_cost_price',
        'sales.override_price',
    ],
    'ACCOUNTANT': [
        'sales.mark_paid',
        'sales.write_off',
        'sales.generate_invoice',
        'sales.view_cost_price',
    ],
    'ADMIN': list(SALES_PERMISSION_CODES.keys()),
}

# ─── Discount Limit Map ───────────────────────────────────────────────────────

DISCOUNT_LIMIT_BY_PERMISSION: list[tuple[str, float]] = [
    ('sales.apply_discount_any', 100.0),
    ('sales.apply_discount_15',   15.0),
    ('sales.apply_discount_5',     5.0),
]


class SalesPermissionService:
    """
    Stateless permission checker for the sales module.
    All methods are classmethods — no instantiation needed.
    """

    @classmethod
    def can(cls, user, permission_code: str) -> bool:
        """
        Returns True if the user holds the given permission code.
        Superusers always have all permissions.
        """
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        if not user.role_id:
            return False
        return user.role.permissions.filter(code=permission_code).exists()

    @classmethod
    def require(cls, user, permission_code: str) -> None:
        """
        Raises PermissionDenied if the user does not have the permission.
        Use this in views/services for strict enforcement.
        """
        from rest_framework.exceptions import PermissionDenied
        if not cls.can(user, permission_code):
            raise PermissionDenied(
                f"Your role does not have permission: '{permission_code}'. "
                f"Contact your administrator."
            )

    @classmethod
    def max_discount_pct(cls, user) -> float:
        """
        Returns the maximum discount percentage the user is allowed to apply.
        Returns 0.0 if no discount permission is granted.
        """
        if not user or not user.is_authenticated:
            return 0.0
        if user.is_superuser:
            return 100.0
        if not user.role_id:
            return 0.0
        user_perm_codes = set(
            user.role.permissions.values_list('code', flat=True)
        )
        for perm_code, limit in DISCOUNT_LIMIT_BY_PERMISSION:
            if perm_code in user_perm_codes:
                return limit
        return 0.0

    @classmethod
    def check_discount(cls, user, discount_pct: float) -> None:
        """
        Raises PermissionDenied if user's discount exceeds their allowed max.
        discount_pct should be 0-100 (e.g. 10.5 for 10.5%).
        """
        from rest_framework.exceptions import PermissionDenied
        max_pct = cls.max_discount_pct(user)
        if discount_pct > max_pct:
            raise PermissionDenied(
                f"Discount {discount_pct:.1f}% exceeds your authorization limit "
                f"of {max_pct:.1f}%. A manager override PIN is required."
            )

    # ─── Bootstrap ────────────────────────────────────────────────────────────

    @classmethod
    def ensure_sales_permissions(cls, organization) -> dict:
        """
        Idempotent: ensures all SALES_PERMISSION_CODES exist in the Permission table
        and that the bootstrap roles have them assigned.

        Call once from a management command or migration data migration.
        Returns a summary dict {'created': [...], 'roles_updated': [...]}.
        """
        from erp.models import Permission, Role

        created_perms = []
        for code, description in SALES_PERMISSION_CODES.items():
            _perm, created = Permission.objects.get_or_create(
                code=code,
                defaults={'name': description, 'description': description}
            )
            if created:
                created_perms.append(code)

        roles_updated = []
        for role_name, perm_codes in BOOTSTRAP_ROLES.items():
            role, _ = Role.objects.get_or_create(
                name=role_name,
                organization=organization,
                defaults={'description': f'Bootstrap role: {role_name}'}
            )
            perms = Permission.objects.filter(code__in=perm_codes)
            role.permissions.add(*perms)
            roles_updated.append(role_name)

        return {'created_permissions': created_perms, 'roles_updated': roles_updated}
