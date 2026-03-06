"""
Replay Events Management Command

Replay historical events for rebuilding read models or testing.

Usage:
    python manage.py replay_events --event-type=invoice.created
    python manage.py replay_events --aggregate-type=invoice
    python manage.py replay_events --start-date="2026-01-01" --end-date="2026-03-01"
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime
from kernel.events.outbox import replay_events


class Command(BaseCommand):
    help = 'Replay historical events'

    def add_arguments(self, parser):
        parser.add_argument(
            '--event-type',
            type=str,
            help='Filter by event type (e.g., invoice.created)'
        )
        parser.add_argument(
            '--aggregate-type',
            type=str,
            help='Filter by aggregate type (e.g., invoice)'
        )
        parser.add_argument(
            '--aggregate-id',
            type=str,
            help='Filter by aggregate ID'
        )
        parser.add_argument(
            '--start-date',
            type=str,
            help='Replay from this date (YYYY-MM-DD)'
        )
        parser.add_argument(
            '--end-date',
            type=str,
            help='Replay until this date (YYYY-MM-DD)'
        )

    def handle(self, *args, **options):
        event_type = options.get('event_type')
        aggregate_type = options.get('aggregate_type')
        aggregate_id = options.get('aggregate_id')
        start_date = options.get('start_date')
        end_date = options.get('end_date')

        # Parse dates
        start_time = None
        end_time = None

        if start_date:
            try:
                start_time = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
            except ValueError:
                self.stdout.write(self.style.ERROR(f"Invalid start date format: {start_date}"))
                return

        if end_date:
            try:
                end_time = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d'))
            except ValueError:
                self.stdout.write(self.style.ERROR(f"Invalid end date format: {end_date}"))
                return

        # Build filter description
        filters = []
        if event_type:
            filters.append(f"event_type={event_type}")
        if aggregate_type:
            filters.append(f"aggregate_type={aggregate_type}")
        if aggregate_id:
            filters.append(f"aggregate_id={aggregate_id}")
        if start_date:
            filters.append(f"from {start_date}")
        if end_date:
            filters.append(f"to {end_date}")

        filter_desc = ", ".join(filters) if filters else "all events"

        self.stdout.write(f"🔄 Replaying events: {filter_desc}")

        # Replay events
        replayed_count = replay_events(
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            start_time=start_time,
            end_time=end_time
        )

        self.stdout.write(self.style.SUCCESS(f"✅ Replayed {replayed_count} events"))
