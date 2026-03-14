"""
Request Logging Middleware
--------------------------
Structured JSON request/response logging for observability.
Logs: method, path, status, duration_ms, user, tenant, IP.
Skips: health checks, static files, media files.

Enable in settings.py:
    MIDDLEWARE = [..., 'erp.middleware.request_logger.RequestLoggingMiddleware']

Configure:
    REQUEST_LOGGING_ENABLED = True  # default: True in production, False in DEBUG
    REQUEST_LOGGING_SKIP_PATHS = ['/health/', '/static/', '/media/']
"""
import time
import logging
from django.conf import settings

logger = logging.getLogger('tsfsystem.request')

SKIP_PATHS = getattr(settings, 'REQUEST_LOGGING_SKIP_PATHS', [
    '/health/',
    '/static/',
    '/media/',
    '/favicon.ico',
])


class RequestLoggingMiddleware:
    """Log every API request with structured JSON metadata."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = getattr(settings, 'REQUEST_LOGGING_ENABLED', not settings.DEBUG)

    def __call__(self, request):
        if not self.enabled:
            return self.get_response(request)

        # Skip noise paths
        path = request.path
        if any(path.startswith(skip) for skip in SKIP_PATHS):
            return self.get_response(request)

        start = time.monotonic()
        response = self.get_response(request)
        duration_ms = round((time.monotonic() - start) * 1000, 2)

        # Extract user and tenant safely
        user = getattr(request, 'user', None)
        user_str = str(user) if user and user.is_authenticated else 'anonymous'
        tenant = getattr(request, 'tenant', None)
        tenant_str = str(tenant) if tenant else '-'

        # Structured log
        log_data = {
            'method': request.method,
            'path': path,
            'status': response.status_code,
            'duration_ms': duration_ms,
            'user': user_str,
            'tenant': tenant_str,
            'ip': self._get_client_ip(request),
        }

        # Log level based on status code
        if response.status_code >= 500:
            logger.error("%(method)s %(path)s → %(status)s (%(duration_ms)sms)", log_data, extra=log_data)
        elif response.status_code >= 400:
            logger.warning("%(method)s %(path)s → %(status)s (%(duration_ms)sms)", log_data, extra=log_data)
        else:
            logger.info("%(method)s %(path)s → %(status)s (%(duration_ms)sms)", log_data, extra=log_data)

        return response

    @staticmethod
    def _get_client_ip(request):
        """Extract real client IP from X-Forwarded-For or REMOTE_ADDR."""
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '-')
