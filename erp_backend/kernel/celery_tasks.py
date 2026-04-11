"""
Kernel Celery Tasks

Background tasks for event processing and kernel maintenance.

Setup:
1. Add to your celery.py:
   from kernel.celery_tasks import process_event_outbox, cleanup_old_events

2. Configure beat schedule:
   app.conf.beat_schedule = {
       'process-events': {
           'task': 'kernel.celery_tasks.process_event_outbox',
           'schedule': 10.0,  # Every 10 seconds
       },
       'cleanup-events': {
           'task': 'kernel.celery_tasks.cleanup_old_events',
           'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
       },
       'cleanup-audit-logs': {
           'task': 'kernel.celery_tasks.cleanup_old_audit_logs',
           'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
       },
   }
"""

from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task
def process_event_outbox(batch_size=100):
    """
    Process pending events from the outbox.

    Runs every 10 seconds (recommended).

    Args:
        batch_size: Number of events to process per run
    """
    from kernel.events.outbox import process_outbox

    try:
        result = process_outbox(batch_size=batch_size)
        logger.info(f"Event outbox processed: {result['processed']} successful, {result['failed']} failed")
        return result
    except Exception as e:
        logger.error(f"Error processing event outbox: {str(e)}", exc_info=True)
        raise


@shared_task
def cleanup_old_events(days_to_keep=90):
    """
    Clean up old processed events.

    Runs daily at 2 AM (recommended).

    Args:
        days_to_keep: Keep events from last N days
    """
    from kernel.events.models import DomainEvent

    cutoff_date = timezone.now() - timedelta(days=days_to_keep)

    deleted_count, _ = DomainEvent.objects.filter(
        status='PROCESSED',
        processed_at__lt=cutoff_date
    ).delete()

    logger.info(f"Cleaned up {deleted_count} old events (older than {days_to_keep} days)")
    return {'deleted': deleted_count}


@shared_task
def cleanup_old_audit_logs(days_to_keep=365):
    """
    Clean up old audit logs (keep 1 year by default).

    Runs daily at 3 AM (recommended).

    Args:
        days_to_keep: Keep audit logs from last N days
    """
    from kernel.audit.models import AuditLog

    cutoff_date = timezone.now() - timedelta(days=days_to_keep)

    deleted_count, _ = AuditLog.objects.filter(
        timestamp__lt=cutoff_date
    ).delete()

    logger.info(f"Cleaned up {deleted_count} old audit logs (older than {days_to_keep} days)")
    return {'deleted': deleted_count}


@shared_task
def retry_failed_events(max_age_hours=24):
    """
    Retry failed events that are within retry window.

    Runs every hour (recommended).

    Args:
        max_age_hours: Only retry events younger than this
    """
    from kernel.events.outbox import process_failed_events

    try:
        retried_count = process_failed_events(max_age_hours=max_age_hours)
        logger.info(f"Reset {retried_count} failed events for retry")
        return {'retried': retried_count}
    except Exception as e:
        logger.error(f"Error retrying failed events: {str(e)}", exc_info=True)
        raise


@shared_task
def update_scheduled_feature_flags():
    """
    Update feature flags based on schedule (start_date/end_date).

    Runs every 5 minutes (recommended).
    """
    from kernel.config.models import FeatureFlag
    from django.db.models import Q

    now = timezone.now()

    # Enable flags that reached start_date
    enabled_count = FeatureFlag.objects.filter(
        is_enabled=False,
        start_date__lte=now,
        start_date__isnull=False
    ).update(is_enabled=True)

    # Disable flags that reached end_date
    disabled_count = FeatureFlag.objects.filter(
        is_enabled=True,
        end_date__lte=now,
        end_date__isnull=False
    ).update(is_enabled=False)

    if enabled_count > 0 or disabled_count > 0:
        logger.info(f"Updated feature flags: {enabled_count} enabled, {disabled_count} disabled")

    return {'enabled': enabled_count, 'disabled': disabled_count}


# Example celery.py configuration:
"""
# erp_backend/erp/celery.py
from celery import Celery
from celery.schedules import crontab

app = Celery('erp')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Kernel beat schedule
app.conf.beat_schedule = {
    # Event processing (every 10 seconds)
    'process-event-outbox': {
        'task': 'kernel.celery_tasks.process_event_outbox',
        'schedule': 10.0,
    },

    # Retry failed events (every hour)
    'retry-failed-events': {
        'task': 'kernel.celery_tasks.retry_failed_events',
        'schedule': crontab(minute=0),  # Every hour
    },

    # Update scheduled feature flags (every 5 minutes)
    'update-feature-flags': {
        'task': 'kernel.celery_tasks.update_scheduled_feature_flags',
        'schedule': 300.0,  # 5 minutes
    },

    # Cleanup old events (daily at 2 AM)
    'cleanup-old-events': {
        'task': 'kernel.celery_tasks.cleanup_old_events',
        'schedule': crontab(hour=2, minute=0),
        'kwargs': {'days_to_keep': 90},
    },

    # Cleanup old audit logs (daily at 3 AM)
    'cleanup-old-audit-logs': {
        'task': 'kernel.celery_tasks.cleanup_old_audit_logs',
        'schedule': crontab(hour=3, minute=0),
        'kwargs': {'days_to_keep': 365},
    },
}
"""
