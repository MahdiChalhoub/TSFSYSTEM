"""
RBAC Decorators

Decorators for enforcing permissions on views and functions.
"""

from functools import wraps
from django.http import JsonResponse
from rest_framework.response import Response
from .permissions import check_permission, has_any_permission, has_all_permissions


def require_permission(permission_code: str):
    """
    Decorator to require a specific permission.

    Usage:
        @require_permission('finance.create_invoice')
        def create_invoice(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not check_permission(request.user, permission_code):
                # Determine response type based on view
                if hasattr(view_func, 'cls'):  # DRF class-based view
                    return Response(
                        {'error': f'Permission denied: {permission_code}'},
                        status=403
                    )
                else:  # Django function-based view
                    return JsonResponse(
                        {'error': f'Permission denied: {permission_code}'},
                        status=403
                    )

            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator


def require_any_permission(*permission_codes):
    """
    Decorator to require ANY of the specified permissions.

    Usage:
        @require_any_permission('finance.view_invoice', 'finance.create_invoice')
        def invoice_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not has_any_permission(request.user, permission_codes):
                if hasattr(view_func, 'cls'):
                    return Response(
                        {'error': f'Permission denied: requires one of {permission_codes}'},
                        status=403
                    )
                else:
                    return JsonResponse(
                        {'error': f'Permission denied: requires one of {permission_codes}'},
                        status=403
                    )

            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator


def require_all_permissions(*permission_codes):
    """
    Decorator to require ALL of the specified permissions.

    Usage:
        @require_all_permissions('finance.view_invoice', 'finance.export_data')
        def export_invoices(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not has_all_permissions(request.user, permission_codes):
                if hasattr(view_func, 'cls'):
                    return Response(
                        {'error': f'Permission denied: requires all of {permission_codes}'},
                        status=403
                    )
                else:
                    return JsonResponse(
                        {'error': f'Permission denied: requires all of {permission_codes}'},
                        status=403
                    )

            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator


def permission_required(permission_code: str):
    """
    Alias for require_permission (Django-style naming).
    """
    return require_permission(permission_code)
