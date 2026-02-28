import logging
import traceback
import threading
from django.utils import timezone as django_timezone
from apps.migration.models import MigrationJob
from apps.migration.services import MigrationService

logger = logging.getLogger(__name__)

try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    def shared_task(*args, **kwargs):
        def wrapper(func):
            def delay(*args, **kwargs):
                err_msg = f"Celery not available. Cannot run {func.__name__}."
                logger.error(err_msg)
                raise RuntimeError(err_msg)
            func.delay = delay
            return func
        return wrapper

@shared_task(
    name='apps.migration.run_migration_task',
    time_limit=43200,       # 12 hours hard limit
    soft_time_limit=42000,  # 11h40m soft limit (allows graceful save)
)
def run_migration_task(job_id, organization_id, resume_from=None):
    """Orchestrate the migration process."""
    try:
        job = MigrationJob.objects.get(pk=job_id)
        if job.status == 'RUNNING' and job.last_heartbeat:
            # check if it's really running or just ghosted
            if (django_timezone.now() - job.last_heartbeat).total_seconds() < 60:
                logger.warning(f"Migration job {job_id} is already actively running. Skipping redundant task.")
                return {'status': 'ignored', 'message': 'Job already running'}

        service = MigrationService(job, organization_id)
        service.run(resume_from=resume_from)
        
        return {
            'status': 'success',
            'job_id': job_id,
            'errors': job.total_errors
        }
    except MigrationJob.DoesNotExist:
        logger.error(f"Migration job {job_id} not found.")
        return {'status': 'error', 'message': 'Job not found'}
    except Exception as e:
        # Check if it's a Celery time limit exception
        is_time_limit = 'TimeLimitExceeded' in type(e).__name__ or 'SoftTimeLimitExceeded' in type(e).__name__
        status = 'STALLED' if is_time_limit else 'FAILED'
        err_msg = f"Time limit exceeded after {service.job.current_step}" if is_time_limit else str(e)
        
        logger.exception(f"Fatal error in migration task for job {job_id}: {err_msg}")
        try:
            MigrationJob.objects.filter(pk=job_id).update(
                status=status, 
                error_log=f"{'Time limit exceeded' if is_time_limit else 'Fatal error'}: {err_msg}\n{traceback.format_exc()}",
                completed_at=django_timezone.now()
            )
        except Exception as update_err:
            logger.error(f"Failed to update failed status: {update_err}")
        return {'status': 'error', 'message': err_msg}

@shared_task(name='apps.migration.analyze_migration_task')
def analyze_migration_task(job_id):
    """
    Background task to scan the SQL dump or Direct DB for businesses and metadata.
    Updates the 'discovered_data' field in MigrationJob.
    """
    try:
        job = MigrationJob.objects.get(pk=job_id)
        job.status = 'PARSING'
        job.save()

        if job.source_type == 'SQL_DUMP':
            from apps.migration.parsers import SQLDumpParser
            from apps.storage.backends import get_local_path
            
            file_path = None
            if job.stored_file:
                from apps.storage.models import StorageProvider
                provider = StorageProvider.get_for_organization(job.organization)
                file_path = get_local_path(
                    provider,
                    job.stored_file.storage_key,
                    job.stored_file.bucket
                )
            else:
                file_path = job.file_path

            if not file_path:
                raise ValueError("Migration file not found")

            parser = SQLDumpParser(file_path=file_path)
            parser.parse()
            
            # Optimized analysis in one pass
            analysis, businesses = parser.analyze_all_businesses()
            
            # Map counts back to businesses
            for biz in businesses:
                biz['counts'] = analysis.get(str(biz['id']), {})
            
            job.discovered_data = {
                'businesses': businesses,
                'global_counts': analysis.get('global', {}),
                'analyzed_at': str(django_timezone.now())
            }
        
        elif job.source_type == 'DIRECT_DB':
            from apps.migration.parsers import DirectDBReader
            reader = DirectDBReader(
                host=job.db_host, port=job.db_port or 3306,
                database=job.db_name, user=job.db_user, password=job.db_password,
            )
            reader.connect()
            try:
                analysis, businesses = reader.analyze_all_businesses()
                
                # Map counts back to businesses
                for biz in businesses:
                    biz['counts'] = analysis.get(str(biz['id']), {})

                job.discovered_data = {
                    'businesses': businesses,
                    'global_counts': analysis.get('global', {}),
                    'analyzed_at': str(django_timezone.now())
                }
            finally:
                reader.close()

        job.status = 'PENDING'
        job.save()
        logger.info(f"Analysis complete for migration job {job_id}")

    except Exception as e:
        logger.exception(f"Analysis failed for job {job_id}: {str(e)}")
        try:
            job.status = 'FAILED'
            job.error_log = f"Analysis failed: {str(e)}\n{traceback.format_exc()}"
            job.completed_at = django_timezone.now()
            job.save()
        except Exception as update_err:
            logger.error(f"Failed to save failed status: {update_err}")


@shared_task(name='apps.migration.detect_stalled_jobs')
def detect_stalled_jobs():
    """
    Periodic task to detect and mark stalled migration jobs.
    A job is considered stalled if it's RUNNING but hasn't sent a heartbeat in 15+ minutes.
    Should be scheduled via Celery Beat every 5 minutes.
    """
    from django.utils import timezone as tz
    from datetime import timedelta

    cutoff = tz.now() - timedelta(minutes=15)
    stalled_jobs = MigrationJob.objects.filter(
        status='RUNNING',
        last_heartbeat__lt=cutoff
    )

    count = 0
    for job in stalled_jobs:
        age_min = (tz.now() - job.last_heartbeat).total_seconds() / 60
        logger.warning(
            f"Migration job {job.id} stalled: no heartbeat for {age_min:.0f} minutes. "
            f"Last step: {job.current_step} ({job.current_step_detail or 'no detail'})"
        )
        job.status = 'STALLED'
        job.save()
        count += 1

    if count > 0:
        logger.info(f"Marked {count} migration job(s) as STALLED")
    return {'stalled_count': count}

