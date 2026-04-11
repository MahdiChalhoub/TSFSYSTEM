"""
Quick management command to mark stalled migration jobs.
Usage: python manage.py mark_stalled_jobs
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.migration.models import MigrationJob


class Command(BaseCommand):
    help = 'Mark stalled migration jobs (no heartbeat for 30+ minutes)'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(minutes=30)
        stalled = MigrationJob.objects.filter(
            status='RUNNING',
            last_heartbeat__lt=cutoff
        )
        count = 0
        for job in stalled:
            self.stdout.write(f'Job {job.id}: heartbeat={job.last_heartbeat}, step={job.current_step}')
            job.status = 'STALLED'
            job.save()
            count += 1
            self.stdout.write(f'  -> Marked as STALLED')

        if count == 0:
            self.stdout.write('No stalled jobs found.')
        else:
            self.stdout.write(f'\nMarked {count} job(s) as STALLED.')
