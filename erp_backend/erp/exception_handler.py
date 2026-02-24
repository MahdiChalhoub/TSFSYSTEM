"""
Standardized API Error Handler
===============================
All API errors follow a consistent JSON envelope:

    {
        "status": "error",
        "code": "VALIDATION_ERROR",
        "message": "Human-readable summary",
        "errors": { ... },       # Field-level details (optional)
        "request_id": "abc-123"  # For log correlation
    }

This prevents information leakage in production while giving
developers actionable feedback in development.
"""
import uuid
import logging
from rest_framework.views import exception_handler
from rest_framework.exceptions import (
    APIException, ValidationError, NotAuthenticated,
    AuthenticationFailed, PermissionDenied, NotFound,
    Throttled,
)
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.conf import settings

logger = logging.getLogger('erp')

# Map DRF exception classes to machine-readable codes
ERROR_CODES = {
    ValidationError: 'VALIDATION_ERROR',
    NotAuthenticated: 'NOT_AUTHENTICATED',
    AuthenticationFailed: 'AUTHENTICATION_FAILED',
    PermissionDenied: 'PERMISSION_DENIED',
    NotFound: 'NOT_FOUND',
    Throttled: 'RATE_LIMITED',
}


def tsf_exception_handler(exc, context):
    """
    Custom DRF exception handler that returns consistent error envelopes.
    - Converts Django ValidationErrors to DRF ValidationErrors
    - Adds request_id for log correlation
    - Strips stack traces in production
    """
    # Convert Django ValidationError to DRF format
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            exc = ValidationError(detail=exc.message_dict)
        else:
            exc = ValidationError(detail=exc.messages)

    # Convert Http404 to DRF NotFound
    if isinstance(exc, Http404):
        exc = NotFound(detail=str(exc) or 'Resource not found.')

    # Let DRF handle the response generation
    response = exception_handler(exc, context)

    if response is not None:
        request_id = str(uuid.uuid4())[:8]

        # Determine error code
        error_code = ERROR_CODES.get(type(exc), 'SERVER_ERROR')
        if response.status_code >= 500:
            error_code = 'SERVER_ERROR'

        # Build standardized envelope
        envelope = {
            'status': 'error',
            'code': error_code,
            'request_id': request_id,
        }

        # Extract message
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                envelope['message'] = str(response.data['detail'])
            else:
                envelope['message'] = 'Validation failed.'
                envelope['errors'] = response.data
        elif isinstance(response.data, list):
            envelope['message'] = '; '.join(str(e) for e in response.data)
        else:
            envelope['message'] = str(response.data)

        # Log server errors with full context
        if response.status_code >= 500:
            view = context.get('view', None)
            request = context.get('request', None)
            logger.error(
                'API Server Error [%s]: %s %s → %s',
                request_id,
                request.method if request else '?',
                request.path if request else '?',
                envelope['message'],
                exc_info=exc if settings.DEBUG else None,
            )

        # In production, don't leak error details for 500s
        if response.status_code >= 500 and not settings.DEBUG:
            envelope['message'] = 'An internal error occurred. Contact support with request_id.'
            envelope.pop('errors', None)

        response.data = envelope

    return response
