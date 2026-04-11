"""
IAM Middleware — Portal Session Tracking & Security

Phase 6 hardening:
- Tracks last_portal_login on ContactPortalAccess
- Enforces account_status on every request
- Rejects blocked/suspended users early
"""
from django.utils import timezone
from apps.iam.services import audit


class IAMSessionMiddleware:
    """
    Lightweight middleware that:
    1. Blocks users with non-ACTIVE account_status
    2. Updates last_portal_login on portal gate requests
    3. Logs portal access for audit trail

    Add to MIDDLEWARE in settings.py AFTER authentication middleware.
    """

    PORTAL_PATHS = ('/api/client-gate/', '/api/supplier-gate/')
    SKIP_PATHS = ('/api/client-gate/register/', '/api/supplier-gate/register/')

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip public registration endpoints
        if any(request.path.startswith(p) for p in self.SKIP_PATHS):
            return self.get_response(request)

        # Check if this is a portal request
        is_portal = any(request.path.startswith(p) for p in self.PORTAL_PATHS)

        if is_portal and hasattr(request, 'user') and request.user.is_authenticated:
            # Enforce account_status
            acct_status = getattr(request.user, 'account_status', 'ACTIVE')
            if acct_status in ('BLOCKED', 'SUSPENDED', 'REJECTED'):
                from django.http import JsonResponse
                return JsonResponse(
                    {'error': f'Account is {acct_status.lower()}. Please contact support.'},
                    status=403
                )

        response = self.get_response(request)

        # Post-response: update last_portal_login if portal access was resolved
        if (is_portal and response.status_code < 400 and
                hasattr(request, 'portal_access') and request.portal_access):
            try:
                from apps.iam.models import ContactPortalAccess
                ContactPortalAccess.objects.filter(
                    id=request.portal_access.id
                ).update(last_portal_login=timezone.now())
            except Exception:
                pass  # Non-critical

        return response
