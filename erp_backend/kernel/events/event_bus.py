"""
Event Bus

Core event emission and subscription system.
"""

from typing import Callable, Dict, Any, Optional, List
from django.db import transaction
from django.utils import timezone
from .models import DomainEvent, EventSubscription
from kernel.tenancy.middleware import get_current_tenant
import fnmatch
import logging

logger = logging.getLogger(__name__)


class EventBus:
    """
    Event Bus - Central event routing system

    Responsibilities:
    1. Store events in outbox (transactional)
    2. Route events to registered handlers
    3. Handle event versioning
    4. Support event replay
    """

    # In-memory handler registry (populated at startup)
    _handlers: Dict[str, List[Callable]] = {}

    @classmethod
    def register_handler(cls, event_pattern: str, handler: Callable, priority: int = 0):
        """
        Register an event handler.

        Args:
            event_pattern: Event type pattern (supports wildcards: 'invoice.*')
            handler: Callable that accepts (event: DomainEvent)
            priority: Handler priority (higher = executed first)

        Example:
            EventBus.register_handler('invoice.created', send_invoice_notification)
            EventBus.register_handler('invoice.*', update_analytics)
        """
        if event_pattern not in cls._handlers:
            cls._handlers[event_pattern] = []

        cls._handlers[event_pattern].append({
            'handler': handler,
            'priority': priority
        })

        # Sort by priority (descending)
        cls._handlers[event_pattern].sort(key=lambda x: x['priority'], reverse=True)

        logger.info(f"Registered handler {handler.__name__} for {event_pattern}")

    @classmethod
    def get_handlers(cls, event_type: str) -> List[Callable]:
        """
        Get all handlers for an event type.

        Supports wildcard matching:
        - 'invoice.*' matches 'invoice.created', 'invoice.updated', etc.
        - '*' matches all events
        """
        handlers = []

        for pattern, pattern_handlers in cls._handlers.items():
            if fnmatch.fnmatch(event_type, pattern):
                handlers.extend([h['handler'] for h in pattern_handlers])

        return handlers

    @classmethod
    def emit(
        cls,
        event_type: str,
        payload: Dict[str, Any],
        aggregate_type: str = '',
        aggregate_id: str = '',
        event_version: int = 1,
        triggered_by=None,
        process_immediately: bool = False
    ) -> DomainEvent:
        """
        Emit a domain event.

        Args:
            event_type: Event type (e.g., 'invoice.created')
            payload: Event data
            aggregate_type: Entity type (e.g., 'invoice')
            aggregate_id: Entity ID
            event_version: Event schema version
            triggered_by: User who triggered event
            process_immediately: Process handlers immediately (default: async via outbox)

        Returns:
            DomainEvent instance

        Example:
            event = EventBus.emit(
                event_type='invoice.created',
                payload={'invoice_id': 123, 'total': '100.00'},
                aggregate_type='invoice',
                aggregate_id='123'
            )
        """
        organization = get_current_tenant()
        if not organization:
            raise ValueError("Cannot emit event without organization context")

        # Sanitize payload for JSON (UUIDs are not serializable by default in some contexts)
        import uuid
        def _sanitize(data):
            if isinstance(data, dict):
                return {k: _sanitize(v) for k, v in data.items()}
            elif isinstance(data, list):
                return [_sanitize(i) for i in data]
            elif isinstance(data, uuid.UUID):
                return str(data)
            return data

        # Create event in outbox (transactional)
        event = DomainEvent.objects.create(
            organization=organization,
            event_type=event_type,
            event_version=event_version,
            payload=_sanitize(payload),
            aggregate_type=aggregate_type,
            aggregate_id=str(aggregate_id) if aggregate_id else '',
            triggered_by=triggered_by,
            status='PENDING'
        )

        logger.info(f"Event emitted: {event_type} | {aggregate_type}:{aggregate_id}")

        # Process immediately if requested (synchronous)
        if process_immediately:
            cls.process_event(event)

        return event

    @classmethod
    def process_event(cls, event: DomainEvent):
        """
        Process an event by calling all registered handlers.

        Args:
            event: DomainEvent to process

        This is called by:
        - Outbox processor (background worker)
        - emit() if process_immediately=True
        """
        if event.status == 'PROCESSED':
            logger.warning(f"Event {event.event_id} already processed, skipping")
            return

        # Mark as processing
        event.status = 'PROCESSING'
        event.save()

        try:
            # Get handlers for this event type
            handlers = cls.get_handlers(event.event_type)

            if not handlers:
                logger.warning(f"No handlers for event type: {event.event_type}")
                event.mark_processed()
                return

            # Execute handlers
            for handler in handlers:
                try:
                    logger.info(f"Executing handler {handler.__name__} for {event.event_type}")
                    handler(event)
                except Exception as e:
                    logger.error(f"Handler {handler.__name__} failed: {str(e)}", exc_info=True)
                    # Continue with other handlers (isolated failure)

            # Mark as processed
            event.mark_processed()
            logger.info(f"Event processed successfully: {event.event_id}")

        except Exception as e:
            # Mark as failed
            error_msg = f"Event processing failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            event.mark_failed(error_msg)


# Module-level convenience functions

def emit_event(
    event_type: str,
    payload: Dict[str, Any],
    aggregate_type: str = '',
    aggregate_id: str = '',
    event_version: int = 1,
    triggered_by=None,
    process_immediately: bool = False
) -> DomainEvent:
    """
    Emit a domain event with contract validation.

    Validates payload against registered contract (if exists).
    Raises ValidationError if payload doesn't match contract schema.

    Convenience wrapper for EventBus.emit()

    Example:
        from kernel.events import emit_event

        emit_event(
            event_type='invoice.voided',
            payload={'invoice_id': invoice.id, 'reason': 'Duplicate'},
            aggregate_type='invoice',
            aggregate_id=invoice.id
        )
    """
    # Validate payload against contract (if contract exists)
    try:
        from kernel.contracts.registry import ContractRegistry
        from kernel.contracts.validators import validate_payload, ValidationError

        contract = ContractRegistry.get(event_type)
        if contract:
            # Validate payload against schema
            validate_payload(payload, contract, raise_on_error=True)
            logger.debug(f"✓ Contract validation passed for {event_type}")
    except ValidationError as e:
        logger.error(f"❌ Contract validation failed for {event_type}: {str(e)}")
        raise
    except ImportError:
        # Contracts system not available (shouldn't happen but fail gracefully)
        logger.warning(f"Contracts system not available, skipping validation for {event_type}")
    except Exception as e:
        # Other validation errors - log but don't block emission
        logger.warning(f"Contract validation error for {event_type}: {str(e)}")

    return EventBus.emit(
        event_type=event_type,
        payload=payload,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        event_version=event_version,
        triggered_by=triggered_by,
        process_immediately=process_immediately
    )


def subscribe_to_event(event_pattern: str, priority: int = 0):
    """
    Decorator to subscribe a function to an event.

    Args:
        event_pattern: Event type pattern (supports wildcards)
        priority: Handler priority (higher = executed first)

    Example:
        @subscribe_to_event('invoice.created')
        def send_invoice_notification(event):
            invoice_id = event.payload['invoice_id']
            # Send email notification
            pass

        @subscribe_to_event('invoice.*')
        def update_analytics(event):
            # Update analytics dashboard
            pass
    """
    def decorator(func: Callable):
        EventBus.register_handler(event_pattern, func, priority)
        return func
    return decorator
