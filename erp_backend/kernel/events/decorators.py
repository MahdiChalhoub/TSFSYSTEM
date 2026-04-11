"""
Event Decorators

Convenience decorators for event handlers.
"""

from functools import wraps
from .event_bus import EventBus
import logging

logger = logging.getLogger(__name__)


def event_handler(event_pattern: str, priority: int = 0):
    """
    Decorator to mark a function as an event handler.

    Same as subscribe_to_event, but with more explicit naming.

    Args:
        event_pattern: Event type pattern (supports wildcards)
        priority: Handler priority (higher = executed first)

    Example:
        @event_handler('invoice.created', priority=10)
        def high_priority_handler(event):
            # Executed before lower priority handlers
            pass
    """
    def decorator(func):
        EventBus.register_handler(event_pattern, func, priority)
        return func
    return decorator


def idempotent_handler(func):
    """
    Decorator to make event handler idempotent.

    Tracks processed events to prevent duplicate processing.

    Example:
        @event_handler('payment.received')
        @idempotent_handler
        def process_payment(event):
            # Will only run once per event, even if called multiple times
            pass
    """
    processed_events = set()

    @wraps(func)
    def wrapper(event):
        event_id = str(event.event_id)

        if event_id in processed_events:
            logger.info(f"Event {event_id} already processed by {func.__name__}, skipping")
            return

        result = func(event)
        processed_events.add(event_id)
        return result

    return wrapper


def transactional_handler(func):
    """
    Decorator to wrap event handler in database transaction.

    Ensures all database changes are atomic.

    Example:
        @event_handler('invoice.created')
        @transactional_handler
        def create_accounting_entries(event):
            # All DB operations will be in one transaction
            pass
    """
    from django.db import transaction

    @wraps(func)
    def wrapper(event):
        with transaction.atomic():
            return func(event)

    return wrapper


def retry_on_failure(max_retries: int = 3):
    """
    Decorator to retry handler on failure.

    Args:
        max_retries: Maximum number of retry attempts

    Example:
        @event_handler('external.api_call')
        @retry_on_failure(max_retries=3)
        def call_external_api(event):
            # Will retry up to 3 times on failure
            response = requests.post(...)
            response.raise_for_status()
    """
    def decorator(func):
        @wraps(func)
        def wrapper(event):
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(event)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"Handler {func.__name__} failed (attempt {attempt + 1}/{max_retries + 1}): {str(e)}"
                        )
                    else:
                        logger.error(
                            f"Handler {func.__name__} failed after {max_retries + 1} attempts: {str(e)}"
                        )

            # All retries exhausted
            raise last_exception

        return wrapper
    return decorator
