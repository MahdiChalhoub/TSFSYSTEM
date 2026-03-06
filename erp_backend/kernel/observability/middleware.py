"""
Observability Middleware

Automatically tracks requests, errors, and performance.
"""

from django.utils.deprecation import MiddlewareMixin
from .metrics import record_timing, increment_counter
from .sentry_integration import set_context, capture_exception
import time


class ObservabilityMiddleware(MiddlewareMixin):
    """
    Middleware for automatic observability.

    Tracks:
    - Request duration
    - Response status codes
    - Error rates
    - User context (for Sentry)

    Install in settings.py:
    MIDDLEWARE = [
        ...
        'kernel.observability.ObservabilityMiddleware',
        ...
    ]
    """

    def process_request(self, request):
        """Start timing request."""
        request._observability_start_time = time.time()

        # Set user context for Sentry
        if hasattr(request, 'user') and request.user.is_authenticated:
            set_context('user', {
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
            })

        # Set tenant context for Sentry
        if hasattr(request, 'tenant'):
            set_context('tenant', {
                'id': request.tenant.id,
                'name': request.tenant.name,
                'slug': request.tenant.slug,
            })

        # Set request context
        set_context('request', {
            'method': request.method,
            'path': request.path,
            'query_string': request.META.get('QUERY_STRING', ''),
        })

        return None

    def process_response(self, request, response):
        """Track request completion."""
        if hasattr(request, '_observability_start_time'):
            # Calculate duration
            duration_ms = (time.time() - request._observability_start_time) * 1000

            # Record timing
            record_timing(
                'http.request.duration',
                duration_ms,
                tags={
                    'method': request.method,
                    'path': request.path[:50],  # Truncate long paths
                    'status': str(response.status_code),
                }
            )

            # Increment counter
            increment_counter(
                'http.request.count',
                tags={
                    'method': request.method,
                    'status': str(response.status_code),
                }
            )

        return response

    def process_exception(self, request, exception):
        """Track exceptions."""
        # Capture exception to Sentry
        capture_exception(
            exception,
            context={
                'request_path': request.path,
                'request_method': request.method,
                'user_id': request.user.id if hasattr(request, 'user') and request.user.is_authenticated else None,
                'tenant_id': request.tenant.id if hasattr(request, 'tenant') else None,
            },
            tags={
                'module': 'web',
                'component': 'middleware',
            }
        )

        # Increment error counter
        increment_counter(
            'http.request.errors',
            tags={
                'exception_type': exception.__class__.__name__,
            }
        )

        return None
