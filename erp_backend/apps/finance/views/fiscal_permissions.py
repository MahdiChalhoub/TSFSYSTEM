"""
Fiscal viewset permission helper — `FiscalActionPermission`.

Per-action RBAC for FiscalYear / FiscalPeriod viewsets. Extracted so
both `fiscal_views.py` (FiscalYearViewSet) and `fiscal_period_views.py`
(FiscalPeriodViewSet) can import it without circular reference.
"""
from rest_framework import permissions as drf_permissions

from kernel.rbac.permissions import check_permission


class FiscalActionPermission(drf_permissions.BasePermission):
    """
    Per-action RBAC for fiscal viewsets. Reads `action_permission_map` from the
    viewset: {action_name: 'module.perm_code' or (code1, code2, ...)}. Missing
    entries default to `default_permission` or deny.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        action_name = getattr(view, 'action', None)
        perm_map = getattr(view, 'action_permission_map', {}) or {}
        default = getattr(view, 'default_permission', None)
        codes = perm_map.get(action_name, default)
        if codes is None:
            return True  # action not in map and no default — allow (read-safe)
        if isinstance(codes, str):
            codes = (codes,)
        return all(check_permission(request.user, c) for c in codes)
