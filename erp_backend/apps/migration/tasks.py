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
    # ... existing implementation ...
    try:
        job = MigrationJob.objects.get(pk=job_id)
        if job.status in ('COMPLETED', 'RUNNING'):
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
        return {'status': 'error', 'message': str(e)}

@shared_task(name='apps.migration.analyze_migration')
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
                file_path = get_local_path(
                    job.stored_file.storage_provider,
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
                'analyzed_at': str(timezone.now())
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
                    'analyzed_at': str(timezone.now())
                }
            finally:
                reader.close()

        job.status = 'PENDING'
        job.save()
        logger.info(f"Analysis complete for migration job {job_id}")

    except Exception as e:
        logger.exception(f"Analysis failed for job {job_id}: {str(e)}")
        job.status = 'FAILED'
        job.error_log = f"Analysis failed: {str(e)}"
        job.save()

from django.utils import timezone
