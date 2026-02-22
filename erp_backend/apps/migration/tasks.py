try:
    from celery import shared_task
except ImportError:
    # Fallback for environments without Celery
    def shared_task(name=None):
        def wrapper(func):
            func.delay = lambda *args, **kwargs: func(*args, **kwargs)
            return func
        return wrapper

import logging
from apps.migration.models import MigrationJob
from apps.migration.services import MigrationService

logger = logging.getLogger(__name__)

@shared_task(name='apps.migration.run_migration')
def run_migration_task(job_id, organization_id):
    """
    Background task to execute a migration job.
    Successfully handles steaming data and cloud storage.
    """
    try:
        job = MigrationJob.objects.get(pk=job_id)
        if job.status in ('COMPLETED', 'RUNNING', 'PARSING'):
            logger.warning(f"Migration job {job_id} is already in state {job.status}. Skipping.")
            return

        service = MigrationService(job, organization_id)
        service.run()
        
        return {
            'status': 'success',
            'job_id': job_id,
            'errors': job.total_errors
        }
    except MigrationJob.DoesNotExist:
        logger.error(f"Migration job {job_id} not found.")
        return {'status': 'error', 'message': 'Job not found'}
    except Exception as e:
        logger.exception(f"Fatal error in migration task for job {job_id}: {str(e)}")
        # MigrationService.run() handles most internal errors and marks job as FAILED
        return {'status': 'error', 'message': str(e)}
