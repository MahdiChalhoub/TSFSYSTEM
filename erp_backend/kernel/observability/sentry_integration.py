"""
Sentry Integration

Error tracking and performance monitoring.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Try to import Sentry SDK
try:
    import sentry_sdk
    from sentry_sdk import capture_exception as sentry_capture_exception
    from sentry_sdk import capture_message as sentry_capture_message
    from sentry_sdk import set_tag, set_context as sentry_set_context
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False
    logger.warning("Sentry SDK not installed. Install with: pip install sentry-sdk")


def capture_exception(
    exception: Exception,
    context: Optional[Dict[str, Any]] = None,
    tags: Optional[Dict[str, str]] = None
):
    """
    Capture exception to Sentry.

    Args:
        exception: Exception to capture
        context: Additional context data
        tags: Tags for filtering

    Example:
        try:
            process_invoice(invoice_id)
        except Exception as e:
            capture_exception(e, {
                'invoice_id': invoice_id,
                'user_id': request.user.id
            }, {
                'module': 'finance',
                'action': 'process_invoice'
            })
    """
    # Log locally first
    logger.error(f"Exception captured: {str(exception)}", exc_info=True)

    if not SENTRY_AVAILABLE:
        return

    # Set tags
    if tags:
        for key, value in tags.items():
            set_tag(key, value)

    # Set context
    if context:
        sentry_set_context('custom', context)

    # Capture exception
    sentry_capture_exception(exception)


def capture_message(
    message: str,
    level: str = 'info',
    context: Optional[Dict[str, Any]] = None,
    tags: Optional[Dict[str, str]] = None
):
    """
    Capture message to Sentry.

    Args:
        message: Message to capture
        level: Log level (debug, info, warning, error, fatal)
        context: Additional context data
        tags: Tags for filtering

    Example:
        capture_message(
            'Invoice processing started',
            level='info',
            context={'invoice_id': 123},
            tags={'module': 'finance'}
        )
    """
    # Log locally
    log_func = getattr(logger, level, logger.info)
    log_func(message)

    if not SENTRY_AVAILABLE:
        return

    # Set tags
    if tags:
        for key, value in tags.items():
            set_tag(key, value)

    # Set context
    if context:
        sentry_set_context('custom', context)

    # Capture message
    sentry_capture_message(message, level)


def set_context(context_name: str, data: Dict[str, Any]):
    """
    Set context for subsequent Sentry events.

    Args:
        context_name: Context name (e.g., 'user', 'invoice', 'request')
        data: Context data

    Example:
        set_context('invoice', {
            'id': invoice.id,
            'number': invoice.invoice_number,
            'total': str(invoice.total)
        })
    """
    if SENTRY_AVAILABLE:
        sentry_set_context(context_name, data)


def initialize_sentry(dsn: str, environment: str = 'production', **kwargs):
    """
    Initialize Sentry SDK.

    Should be called in settings.py or Django app ready().

    Args:
        dsn: Sentry DSN
        environment: Environment name
        **kwargs: Additional Sentry options

    Example:
        # In settings.py
        if os.getenv('SENTRY_DSN'):
            from kernel.observability import initialize_sentry
            initialize_sentry(
                dsn=os.getenv('SENTRY_DSN'),
                environment=os.getenv('ENVIRONMENT', 'production'),
                traces_sample_rate=0.1,
                profiles_sample_rate=0.1
            )
    """
    if not SENTRY_AVAILABLE:
        logger.error("Cannot initialize Sentry: SDK not installed")
        return

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        # Enable performance monitoring
        traces_sample_rate=kwargs.get('traces_sample_rate', 0.1),
        # Enable profiling
        profiles_sample_rate=kwargs.get('profiles_sample_rate', 0.1),
        # Send PII (personally identifiable information)
        send_default_pii=kwargs.get('send_default_pii', False),
        **{k: v for k, v in kwargs.items() if k not in ['traces_sample_rate', 'profiles_sample_rate', 'send_default_pii']}
    )

    logger.info(f"Sentry initialized for environment: {environment}")
