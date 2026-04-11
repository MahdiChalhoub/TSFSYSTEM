"""
Event Bus — domain events with outbox pattern.

Import guide:
    from kernel.events import emit_event, subscribe_to_event
    from kernel.events.models import DomainEvent, EventSubscription  # if model access needed
"""

# NOTE: DomainEvent/EventSubscription are concrete models — NOT imported here.
# Import from kernel.events.models directly to avoid AppRegistryNotReady.

from .event_bus import emit_event, subscribe_to_event, EventBus  # noqa: F401
from .decorators import event_handler  # noqa: F401
from .outbox import process_outbox  # noqa: F401

__all__ = [
    'emit_event',
    'subscribe_to_event',
    'EventBus',
    'event_handler',
    'process_outbox',
]
