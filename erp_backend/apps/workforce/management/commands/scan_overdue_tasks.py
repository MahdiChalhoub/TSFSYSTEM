"""
scan_overdue_tasks — WISE cron integration
==========================================
Scans all organizations for workspace tasks that have passed their
due_date without being completed and emits `workspace.task.overdue`
events for each unique assignee. This feeds WISE Timeliness / Reliability
penalty scores automatically.

Designed to run daily — safe to run multiple times (idempotent per day
via the daily_cap on the WORKSPACE_TASK_OVERDUE rule).

Usage:
    python manage.py scan_overdue_tasks
    python manage.py scan_overdue_tasks --org 3
    python manage.py scan_overdue_tasks --dry-run
    python manage.py scan_overdue_tasks --days-overdue 3   # only 3+ days late
"""
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Emits workforce.task.overdue WISE events for all open overdue workspace tasks.'

    def add_arguments(self, parser):
        parser.add_argument('--org', type=int, default=None, help='Limit to specific organization ID')
        parser.add_argument('--dry-run', action='store_true', default=False, help='Preview without emitting events')
        parser.add_argument('--days-overdue', type=int, default=1, help='Minimum days past due (default: 1)')

    def handle(self, *args, **options):
        from kernel.events import emit_event
        from erp.connector_registry import connector
        Task = connector.require('workspace.tasks.get_model', org_id=0, source='workforce')
        if not Task:
            self.stderr.write(self.style.ERROR("Workspace module not available — cannot scan tasks."))
            return

        org_filter   = options.get('org')
        dry_run      = options['dry_run']
        min_days     = options.get('days_overdue', 1)
        now          = timezone.now()
        cutoff       = now - timezone.timedelta(days=min_days - 1)  # due_date < cutoff

        mode = "[DRY-RUN] " if dry_run else ""
        self.stdout.write(f"WISE Task Scanner: {mode}Scanning for tasks overdue by {min_days}+ day(s)…")

        qs = Task.objects.filter(
            due_date__lt=cutoff,
            status__in=['PENDING', 'IN_PROGRESS'],
        ).exclude(
            assigned_to__isnull=True
        ).select_related('assigned_to', 'organization')

        if org_filter:
            qs = qs.filter(organization_id=org_filter)

        emitted     = 0
        no_employee = 0
        errors      = 0

        for task in qs:
            user = task.assigned_to
            if not user:
                no_employee += 1
                continue

            days_late = (now.date() - task.due_date.date()).days

            if dry_run:
                self.stdout.write(
                    f"  {mode}Task #{task.id} '{task.title[:40]}' "
                    f"— {days_late}d overdue — assigned to {user}"
                )
                emitted += 1
                continue

            try:
                emit_event(
                    'workspace.task.overdue',
                    {
                        'task_id': task.id,
                        'task_title': task.title,
                        'assignee_user_id': user.id,
                        'days_overdue': days_late,
                        'due_date': task.due_date.isoformat() if task.due_date else None,
                        'organization_id': task.organization_id,
                    },
                    aggregate_type='task',
                    aggregate_id=task.id,
                )
                emitted += 1
            except Exception as exc:
                logger.warning(f"WISE scan_overdue_tasks: error on task {task.id}: {exc}")
                errors += 1

        style = self.style.WARNING if dry_run else self.style.SUCCESS
        self.stdout.write(style(
            f"WISE Task Scanner: {mode}{emitted} overdue events emitted, "
            f"{no_employee} skipped (no assignee), {errors} errors."
        ))
