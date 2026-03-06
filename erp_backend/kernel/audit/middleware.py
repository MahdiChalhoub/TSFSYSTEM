"""
Audit Middleware

Automatically captures request context for audit logging.
"""

from django.utils.deprecation import MiddlewareMixin
from .audit_logger import set_audit_context, clear_audit_context


class AuditMiddleware(MiddlewareMixin):
    """
    Middleware to automatically set audit context from request.

    Should be placed AFTER AuthenticationMiddleware and TenantMiddleware:

    MIDDLEWARE = [
        ...
        'django.contrib.auth.middleware.AuthenticationMiddleware',
        'kernel.tenancy.TenantMiddleware',
        'kernel.audit.AuditMiddleware',  # ← Add here
        ...
    ]
    """

    def process_request(self, request):
        """Set audit context at start of request."""
        # Get user
        user = request.user if hasattr(request, 'user') and request.user.is_authenticated else None

        # Get client IP
        ip_address = self._get_client_ip(request)

        # Get user agent
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        # Set audit context
        set_audit_context(
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
            http_method=request.method,
            request_path=request.path
        )

        return None

    def process_response(self, request, response):
        """Clear audit context at end of request."""
        clear_audit_context()
        return response

    def process_exception(self, request, exception):
        """Clear audit context on exception."""
        clear_audit_context()
        return None

    def _get_client_ip(self, request):
        """
        Get client IP address from request.
        Handles X-Forwarded-For header for proxied requests.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            # Take the first IP in the list (client IP)
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
