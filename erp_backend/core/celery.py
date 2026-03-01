"""
Celery Application Configuration
=================================
Configures Celery for the HMZ ERP backend.
Uses Redis as both broker and result backend.
"""
import os
from celery import Celery

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('erp')

# Read config from Django settings, namespace CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()

# ── Celery Beat Schedule ─────────────────────────────────────────────────────
from celery.schedules import crontab

app.conf.beat_schedule = {
    'detect-stalled-migrations': {
        'task': 'apps.migration.detect_stalled_jobs',
        'schedule': 300.0,  # Every 5 minutes
    },
    # ── Auto-Tasking Engine ──────────────────────────────────────────────────
    'fire-recurring-auto-tasks': {
        'task': 'apps.workspace.tasks.fire_recurring_auto_tasks',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'check-stale-orders': {
        'task': 'apps.workspace.tasks.check_stale_orders',
        'schedule': crontab(hour=8, minute=0),  # Daily at 8 AM
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to verify Celery is working."""
    print(f'Request: {self.request!r}')

