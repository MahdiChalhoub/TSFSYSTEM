import logging
import time
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.workforce.models import EmployeeScoreSummary, EmployeeScorePeriod

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Snapshots current WISE scores into historical EmployeeScorePeriod records for trend analysis.'

    def add_arguments(self, parser):
        parser.add_argument('--type', type=str, default='MONTHLY',
                            help='DAILY, WEEKLY, or MONTHLY (default: MONTHLY)')
        parser.add_argument('--org', type=int, default=None,
                            help='Limit snapshot to a specific organization ID')
        parser.add_argument('--period-key', type=str, default=None,
                            help='Override the auto-computed period key (e.g. 2026-02 to backfill)')
        parser.add_argument('--dry-run', action='store_true', default=False,
                            help='Preview snapshot counts without writing to DB')

    def handle(self, *args, **options):
        period_type = options['type']
        org_filter  = options.get('org')
        dry_run     = options['dry_run']
        t0          = time.time()
        now         = timezone.now()

        if options.get('period_key'):
            period_key = options['period_key']
        elif period_type == 'MONTHLY':
            period_key = now.strftime('%Y-%m')
        elif period_type == 'WEEKLY':
            period_key = now.strftime('%Y-W%V')
        else:
            period_key = now.strftime('%Y-%m-%d')

        mode = '[DRY-RUN] ' if dry_run else ''
        self.stdout.write(
            f"WISE Snapshot: {mode}{period_type} period {period_key}"
            + (f" — org #{org_filter}" if org_filter else " — all orgs")
        )

        qs = EmployeeScoreSummary.objects.select_related('employee').all()
        if org_filter:
            qs = qs.filter(tenant_id=org_filter)

        created_count  = 0
        updated_count  = 0
        skipped_count  = 0

        for summary in qs:
            if dry_run:
                self.stdout.write(
                    f"  {mode}{summary.employee} → {summary.global_score:.1f} "
                    f"[{period_type} {period_key}]"
                )
                created_count += 1
                continue

            _, created = EmployeeScorePeriod.objects.update_or_create(
                tenant_id=summary.organization_id,
                employee=summary.employee,
                period_type=period_type,
                period_key=period_key,
                defaults={
                    'global_score':       summary.global_score,
                    'performance_score':  summary.performance_score,
                    'trust_score':        summary.trust_score,
                    'compliance_score':   summary.compliance_score,
                    'reliability_score':  summary.reliability_score,
                    'leadership_score':   summary.leadership_score,
                    'rank_company':       summary.current_rank_company,
                    'rank_branch':        summary.current_rank_branch,
                    'rank_role':          summary.current_rank_role,
                    'positive_points':    summary.total_positive_points,
                    'negative_points':    summary.total_negative_points,
                    'net_points':         summary.net_points,
                    'badge_awarded':      summary.badge_level,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        elapsed = time.time() - t0
        style   = self.style.WARNING if dry_run else self.style.SUCCESS
        self.stdout.write(style(
            f"WISE Snapshot: {mode}✓ {created_count} created, {updated_count} updated, "
            f"{skipped_count} skipped — {elapsed:.2f}s"
        ))
