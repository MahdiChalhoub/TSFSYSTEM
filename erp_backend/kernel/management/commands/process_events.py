"""
Process Events Management Command

Processes pending events from the outbox.

Usage:
    python manage.py process_events
    python manage.py process_events --batch-size=200
    python manage.py process_events --retry-failed
"""

from django.core.management.base import BaseCommand
from kernel.events.outbox import process_outbox, process_failed_events


class Command(BaseCommand):
    help = 'Process pending events from outbox'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of events to process in one batch (default: 100)'
        )
        parser.add_argument(
            '--retry-failed',
            action='store_true',
            help='Retry failed events'
        )
        parser.add_argument(
            '--max-age-hours',
            type=int,
            default=24,
            help='Maximum age of failed events to retry (default: 24)'
        )

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        retry_failed = options['retry_failed']
        max_age_hours = options['max_age_hours']

        self.stdout.write("🔄 Processing event outbox...")

        # Process pending events
        result = process_outbox(batch_size=batch_size)

        self.stdout.write(self.style.SUCCESS(
            f"✅ Processed {result['processed']} events, {result['failed']} failed"
        ))

        # Retry failed events if requested
        if retry_failed:
            self.stdout.write(f"\n🔁 Retrying failed events (max age: {max_age_hours}h)...")
            retried_count = process_failed_events(max_age_hours=max_age_hours)
            self.stdout.write(self.style.SUCCESS(
                f"✅ Reset {retried_count} failed events for retry"
            ))
