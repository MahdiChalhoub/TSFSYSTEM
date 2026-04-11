"""
IAM Guards — Portal access decorators.

These are the security barriers between portals and ERP data.
Every portal view must use the appropriate guard.

Guard chain:
1. Authenticate user
2. Verify User.account_status == ACTIVE
3. Resolve active ContactPortalAccess
4. Verify access.status == ACTIVE
5. Verify portal/channel flags
6. Attach context to request
"""
from functools import wraps
from rest_framework.response import Response
from rest_framework import status


def require_client_portal_access(view_func):
    """
    DRF view decorator: require active client portal access.
    Injects `request.portal_access` and `request.portal_contact` on the request.
    """
    @wraps(view_func)
    def wrapper(self, request, *args, **kwargs):
        from apps.iam.services.portal_access import resolve_active_context

        # Guard 1: user account active
        if getattr(request.user, 'account_status', 'ACTIVE') != 'ACTIVE':
            return Response(
                {'error': 'Your account is not active. Please contact support.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Guard 2: resolve active client access
        preferred = request.headers.get('X-Portal-Contact-Id')
        preferred_id = int(preferred) if preferred and preferred.isdigit() else None

        access = resolve_active_context(
            request.user, 'CLIENT',
            organization=getattr(request.user, 'organization', None),
            preferred_contact_id=preferred_id,
        )

        if not access:
            return Response(
                {'error': 'No active client portal access. Please contact support.'},
                status=status.HTTP_403_FORBIDDEN
            )

        request.portal_access = access
        request.portal_contact = access.contact
        return view_func(self, request, *args, **kwargs)

    return wrapper


def require_supplier_portal_access(view_func):
    """
    DRF view decorator: require active supplier portal access.
    Injects `request.portal_access` and `request.portal_contact` on the request.
    """
    @wraps(view_func)
    def wrapper(self, request, *args, **kwargs):
        from apps.iam.services.portal_access import resolve_active_context

        if getattr(request.user, 'account_status', 'ACTIVE') != 'ACTIVE':
            return Response(
                {'error': 'Your account is not active. Please contact the administrator.'},
                status=status.HTTP_403_FORBIDDEN
            )

        preferred = request.headers.get('X-Portal-Contact-Id')
        preferred_id = int(preferred) if preferred and preferred.isdigit() else None

        access = resolve_active_context(
            request.user, 'SUPPLIER',
            organization=getattr(request.user, 'organization', None),
            preferred_contact_id=preferred_id,
        )

        if not access:
            return Response(
                {'error': 'No active supplier portal access. Please contact the administrator.'},
                status=status.HTTP_403_FORBIDDEN
            )

        request.portal_access = access
        request.portal_contact = access.contact
        return view_func(self, request, *args, **kwargs)

    return wrapper
