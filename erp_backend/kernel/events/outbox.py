"""
Outbox Processor

Background worker to process pending events from the outbox.
"""

from django.utils import timezone
from django.db import transaction
from .models import DomainEvent
from .event_bus import EventBus
from kernel.tenancy.context import tenant_context
import logging

logger = logging.getLogger(__name__)


def process_outbox(batch_size: int = 100):
    """
    Process pending events from the outbox.

    This should be called by:
    1. Celery task (every 10 seconds)
    2. Management command (for manual processing)
    3. Post-request signal (optional, for low-latency)

    Args:
        batch_size: Number of events to process in one batch

    Example Celery Task:
        @app.task
        def process_event_outbox():
            from kernel.events import process_outbox
            process_outbox(batch_size=100)

    Example Management Command:
        python manage.py process_events
    """
    # Get pending events (ready for processing)
    pending_events = DomainEvent.objects.filter(
        status='PENDING'
    ).filter(
        models.Q(next_retry_at__isnull=True) | models.Q(next_retry_at__lte=timezone.now())
    ).order_by('created_at')[:batch_size]

    processed_count = 0
    failed_count = 0

    for event in pending_events:
        try:
            # Set tenant context
            with tenant_context(event.tenant):
                EventBus.process_event(event)
                processed_count += 1

        except Exception as e:
            logger.error(f"Failed to process event {event.event_id}: {str(e)}", exc_info=True)
            failed_count += 1

    if processed_count > 0 or failed_count > 0:
        logger.info(f"Outbox processed: {processed_count} successful, {failed_count} failed")

    return {
        'processed': processed_count,
        'failed': failed_count
    }


def process_failed_events(max_age_hours: int = 24):
    """
    Retry failed events that are within retry window.

    Args:
        max_age_hours: Only retry events younger than this (to prevent infinite retries)

    Example:
        # Retry failed events from last 24 hours
        process_failed_events(max_age_hours=24)
    """
    from datetime import timedelta

    cutoff_time = timezone.now() - timedelta(hours=max_age_hours)

    failed_events = DomainEvent.objects.filter(
        status='FAILED',
        created_at__gte=cutoff_time,
        retry_count__lt=models.F('max_retries')
    )

    retried_count = 0

    for event in failed_events:
        # Reset to PENDING for retry
        event.status = 'PENDING'
        event.save()
        retried_count += 1

    logger.info(f"Reset {retried_count} failed events for retry")
    return retried_count


def replay_events(
    event_type: str = None,
    aggregate_type: str = None,
    aggregate_id: str = None,
    start_time=None,
    end_time=None
):
    """
    Replay historical events.

    Useful for:
    - Rebuilding read models
    - Testing new event handlers
    - Recovering from data loss

    Args:
        event_type: Filter by event type
        aggregate_type: Filter by aggregate type
        aggregate_id: Filter by aggregate ID
        start_time: Replay from this time
        end_time: Replay until this time

    Example:
        # Replay all invoice events
        replay_events(aggregate_type='invoice')

        # Replay specific event type
        replay_events(event_type='invoice.voided')
    """
    query = DomainEvent.objects.all()

    if event_type:
        query = query.filter(event_type=event_type)
    if aggregate_type:
        query = query.filter(aggregate_type=aggregate_type)
    if aggregate_id:
        query = query.filter(aggregate_id=aggregate_id)
    if start_time:
        query = query.filter(created_at__gte=start_time)
    if end_time:
        query = query.filter(created_at__lte=end_time)

    events = query.order_by('created_at')
    replayed_count = 0

    logger.info(f"Starting event replay: {events.count()} events")

    for event in events:
        try:
            with tenant_context(event.tenant):
                # Create a copy to avoid modifying original event
                event_copy = DomainEvent(
                    tenant=event.tenant,
                    event_type=event.event_type,
                    event_version=event.event_version,
                    payload=event.payload,
                    aggregate_type=event.aggregate_type,
                    aggregate_id=event.aggregate_id,
                    triggered_by=event.triggered_by
                )

                # Process without saving (replay mode)
                EventBus.process_event(event_copy)
                replayed_count += 1

        except Exception as e:
            logger.error(f"Failed to replay event {event.event_id}: {str(e)}", exc_info=True)

    logger.info(f"Event replay complete: {replayed_count} events replayed")
    return replayed_count
