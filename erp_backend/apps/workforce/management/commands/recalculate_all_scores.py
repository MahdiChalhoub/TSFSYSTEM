"""
WISE Engine — recalculate_all_scores
=====================================
Rebuilds every employee's score summary from scratch by re-aggregating all
CONFIRMED events. Run this after:
  - Bulk rule changes (base_points updates)
  - Reverting multiple events via admin
  - Initial engine deployment

Usage:
    python manage.py recalculate_all_scores
    python manage.py recalculate_all_scores --org 3       # single org
    python manage.py recalculate_all_scores --dry-run     # preview counts
"""

import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.hr.models import Employee
from apps.workforce.services import WorkforceScoreEngine

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Recalculates all employee WISE summaries from the confirmed event log.'

    def add_arguments(self, parser):
        parser.add_argument('--org', type=int, help='Limit to a single organization ID')
        parser.add_argument('--dry-run', action='store_true', help='Count employees without recalculating')

    def handle(self, *args, **options):
        org_id   = options.get('org')
        dry_run  = options.get('dry_run')
        
        qs = Employee.objects.select_related('user', 'organization')
        if org_id:
            qs = qs.filter(tenant_id=org_id)

        total = qs.count()
        self.stdout.write(f"WISE: {'[DRY-RUN] ' if dry_run else ''}Found {total} employees to process.")

        if dry_run:
            return

        start = timezone.now()
        success, errors = 0, 0

        # Process each employee
        for emp in qs.iterator(chunk_size=100):
            try:
                WorkforceScoreEngine.update_employee_summary(emp)
                success += 1
                if success % 50 == 0:
                    self.stdout.write(f"  … {success}/{total} processed")
            except Exception as exc:
                errors += 1
                self.stderr.write(f"  ERROR for employee {emp.id}: {exc}")

        # Recalculate rankings per organization
        org_ids = set(qs.values_list('organization_id', flat=True))
        for oid in org_ids:
            try:
                WorkforceScoreEngine.rank_employees(oid)
            except Exception as exc:
                self.stderr.write(f"  Ranking error for org {oid}: {exc}")

        elapsed = (timezone.now() - start).total_seconds()
        self.stdout.write(self.style.SUCCESS(
            f"WISE: Recalculation complete. {success} updated, {errors} errors. ({elapsed:.1f}s)"
        ))
