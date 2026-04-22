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
from django.db.utils import IntegrityError
from django.http import Http404
from django.conf import settings
from rest_framework.response import Response
from rest_framework import status as drf_status
import re

logger = logging.getLogger('erp')


def _integrity_error_message(raw: str) -> str:
    """Turn a raw Postgres IntegrityError into a friendly one-liner.

    Examples handled:
      - unique_violation on UNIQUE(name, tenant_id):
          Key (name, tenant_id)=(test, xxx) already exists.
        → "A record named 'test' already exists. Pick a different name."
      - foreign_key_violation
      - NOT NULL violation
    """
    # UNIQUE constraint violations (most common — duplicate name/code)
    m = re.search(r'Key \(([^)]+)\)=\(([^)]+)\) already exists', raw)
    if m:
        fields = [f.strip() for f in m.group(1).split(',')]
        values = [v.strip() for v in m.group(2).split(',')]
        # Drop the tenant_id pair — it's internal
        pairs = [(f, v) for f, v in zip(fields, values) if f != 'tenant_id']
        if pairs:
            if len(pairs) == 1:
                f, v = pairs[0]
                return f'A record with {f} "{v}" already exists. Pick a different {f} or edit the existing one.'
            label = ', '.join(f'{f}="{v}"' for f, v in pairs)
            return f'A record with {label} already exists. Pick different values or edit the existing one.'
        return 'That record already exists.'

    # Foreign key violations
    if 'foreign key constraint' in raw.lower() or 'violates foreign key' in raw.lower():
        m = re.search(r'table "([^"]+)"', raw)
        table = m.group(1) if m else 'another record'
        return f'Cannot complete — this record is referenced by {table}. Remove the references first.'

    # NOT NULL violations
    m = re.search(r'null value in column "([^"]+)"', raw)
    if m:
        return f'The "{m.group(1)}" field is required.'

    # Check constraint
    if 'check constraint' in raw.lower():
        return 'A value is out of the allowed range. Please review your input.'

    return 'The database rejected this operation because it conflicts with existing data.'

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

    # Convert DB IntegrityError (unique/FK violations) to a friendly 409 conflict
    # instead of a bare 500. Parses Postgres DETAIL lines like:
    #   Key (name, tenant_id)=(test, xxx) already exists.
    if isinstance(exc, IntegrityError):
        raw = str(exc)
        friendly = _integrity_error_message(raw)
        response = Response(
            {
                'status': 'error',
                'code': 'CONFLICT',
                'message': friendly,
                'request_id': str(uuid.uuid4())[:8],
            },
            status=drf_status.HTTP_409_CONFLICT,
        )
        logger.warning('API IntegrityError → 409: %s', raw[:300])
        return response

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
