
import os
import sys
import django
from celery import Celery

# Setup Django
sys.path.append('/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.conf import settings

print(f"--- MIGRATION ENGINE HEALTH CHECK ---")
print(f"Broker URL: {settings.CELERY_BROKER_URL}")

try:
    app = Celery('core')
    app.config_from_object('django.conf:settings', namespace='CELERY')
    
    # Check if we can connect to Redis
    import redis
    r = redis.from_url(settings.CELERY_BROKER_URL)
    r.ping()
    print("✅ Redis Connection: OK")
    
    # Check for active workers
    inspect = app.control.inspect()
    active = inspect.active()
    if active:
        print(f"✅ Active Workers: {len(active)}")
        for worker, tasks in active.items():
            print(f"   - {worker}: {len(tasks)} tasks running")
    else:
        print("❌ Active Workers: NONE (Background tasks will not process!)")
        
    # Check queue length
    queue_len = r.llen('celery')
    print(f"📊 Queued Tasks: {queue_len}")

except Exception as e:
    print(f"❌ Error during health check: {str(e)}")

print("-------------------------------------")
