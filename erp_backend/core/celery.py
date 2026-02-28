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
app.conf.beat_schedule = {
    'detect-stalled-migrations': {
        'task': 'apps.migration.detect_stalled_jobs',
        'schedule': 300.0,  # Every 5 minutes
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to verify Celery is working."""
    print(f'Request: {self.request!r}')

