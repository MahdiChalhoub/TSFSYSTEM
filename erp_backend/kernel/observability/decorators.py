"""
Observability Decorators

Decorators for tracking performance and errors.
"""

from functools import wraps
from .metrics import record_timing, increment_counter, timed
from .sentry_integration import capture_exception
import time
import logging

logger = logging.getLogger(__name__)


def track_performance(metric_name: str = None, tags: dict = None):
    """
    Decorator to track function performance.

    Args:
        metric_name: Metric name (defaults to function name)
        tags: Tags for filtering

    Example:
        @track_performance('invoice.processing_time', tags={'module': 'finance'})
        def process_invoice(invoice_id):
            ...
    """
    def decorator(func):
        nonlocal metric_name
        if metric_name is None:
            metric_name = f"{func.__module__}.{func.__name__}"

        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.time() - start) * 1000
                record_timing(metric_name, duration_ms, tags)

        return wrapper
    return decorator


def track_errors(capture_to_sentry: bool = True, tags: dict = None):
    """
    Decorator to track function errors.

    Args:
        capture_to_sentry: Whether to send errors to Sentry
        tags: Tags for filtering

    Example:
        @track_errors(tags={'module': 'finance'})
        def process_invoice(invoice_id):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Log error
                logger.error(f"Error in {func.__name__}: {str(e)}", exc_info=True)

                # Increment error counter
                increment_counter(
                    f'errors.{func.__name__}',
                    tags={
                        'exception_type': e.__class__.__name__,
                        **(tags or {})
                    }
                )

                # Capture to Sentry
                if capture_to_sentry:
                    capture_exception(
                        e,
                        context={
                            'function': func.__name__,
                            'module': func.__module__,
                        },
                        tags=tags
                    )

                # Re-raise exception
                raise

        return wrapper
    return decorator


def track_and_time(metric_name: str = None, capture_errors: bool = True, tags: dict = None):
    """
    Combined decorator for performance tracking and error capturing.

    Args:
        metric_name: Metric name
        capture_errors: Whether to capture errors
        tags: Tags for filtering

    Example:
        @track_and_time('invoice.processing', tags={'module': 'finance'})
        def process_invoice(invoice_id):
            ...
    """
    def decorator(func):
        # Apply both decorators
        func = track_performance(metric_name, tags)(func)
        if capture_errors:
            func = track_errors(capture_to_sentry=True, tags=tags)(func)
        return func
    return decorator
