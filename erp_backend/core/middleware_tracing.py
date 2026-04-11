"""
TSFSYSTEM Structured Logging Middleware

Adds request correlation IDs and structured logging context
to every request for observability and incident tracing.
"""
import uuid
import time
import logging
import json

logger = logging.getLogger('tsfsystem.request')


class RequestTracingMiddleware:
    """
    Adds a unique correlation ID to every request and logs
    structured request/response data for observability.
    
    Headers:
      - X-Request-ID: correlation ID (generated if not present)
      - X-Trace-ID: same, returned in response for client correlation
    
    Structured log fields:
      - correlation_id, method, path, status, duration_ms,
        tenant, user, ip
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Generate or accept correlation ID
        correlation_id = request.headers.get('X-Request-ID', str(uuid.uuid4())[:12])
        request.correlation_id = correlation_id

        start_time = time.monotonic()
        response = self.get_response(request)
        duration_ms = round((time.monotonic() - start_time) * 1000, 2)

        # Add correlation ID to response
        response['X-Request-ID'] = correlation_id
        response['X-Trace-ID'] = correlation_id

        # Skip health checks and static files from logging
        path = request.path
        if path.startswith('/health') or path.startswith('/static'):
            return response

        # Build structured log entry
        log_data = {
            'correlation_id': correlation_id,
            'method': request.method,
            'path': path,
            'status': response.status_code,
            'duration_ms': duration_ms,
            'ip': self._get_client_ip(request),
        }

        # Add tenant context if available
        if hasattr(request, 'tenant') and request.tenant:
            log_data['tenant'] = str(getattr(request.tenant, 'slug', request.tenant))

        # Add user context if available
        if hasattr(request, 'user') and request.user.is_authenticated:
            log_data['user'] = request.user.email or str(request.user.id)

        # Log at appropriate level
        if response.status_code >= 500:
            logger.error(json.dumps(log_data))
        elif response.status_code >= 400:
            logger.warning(json.dumps(log_data))
        elif duration_ms > 2000:
            log_data['slow'] = True
            logger.warning(json.dumps(log_data))
        else:
            logger.info(json.dumps(log_data))

        return response

    @staticmethod
    def _get_client_ip(request):
        """Extract real client IP from proxy headers."""
        forwarded = request.headers.get('X-Forwarded-For')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
