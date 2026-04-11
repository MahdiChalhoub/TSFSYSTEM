"""
WISE Engine — award_workforce_badges
=====================================
Closes a scoring period and awards badges to all qualifying employees.
Run at the end of each month (e.g. a cron on the 1st at 00:05).

Workflow:
  1. Identify the period key to close (defaults to prior month)
  2. For each employee, look up their EmployeeScorePeriod snapshot or calculate from current summary
  3. Assign the appropriate badge (PLATINUM/GOLD/SILVER/BRONZE/WATCHLIST)
  4. Create an EmployeeBadge record if not already awarded for this period
  5. Emit a workforce.badges_awarded event (can trigger notifications)

Usage:
    python manage.py award_workforce_badges
    python manage.py award_workforce_badges --period 2026-02
    python manage.py award_workforce_badges --org 3 --dry-run
"""

import logging
from datetime import date
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.workforce.models import (
    EmployeeScoreSummary, EmployeeScorePeriod,
    EmployeeBadge, BadgeLevel
)
from apps.workforce.services import WorkforceScoreEngine

logger = logging.getLogger(__name__)

# Score thresholds for badge assignment (mirrors determine_badge in services.py)
BADGE_THRESHOLDS = [
    (90, BadgeLevel.PLATINUM),
    (80, BadgeLevel.GOLD),
    (70, BadgeLevel.SILVER),
    (60, BadgeLevel.BRONZE),
    (0,  BadgeLevel.WATCHLIST),
]

BADGE_LABELS = {
    BadgeLevel.PLATINUM: '🏆 Platinum Performer',
    BadgeLevel.GOLD:     '🥇 Gold Performer',
    BadgeLevel.SILVER:   '🥈 Silver Performer',
    BadgeLevel.BRONZE:   '🥉 Bronze Performer',
    BadgeLevel.WATCHLIST:'⚠️  Watchlist — Action Required',
}


def _resolve_badge(score: float) -> str:
    for threshold, badge in BADGE_THRESHOLDS:
        if float(score) >= threshold:
            return badge
    return BadgeLevel.WATCHLIST


class Command(BaseCommand):
    help = 'Awards performance badges to all employees for the closed period.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--period',
            type=str,
            default=None,
            help='Period key to close (e.g. 2026-02). Defaults to the previous calendar month.'
        )
        parser.add_argument('--org', type=int, help='Limit to a single organization ID.')
        parser.add_argument('--dry-run', action='store_true', help='Preview what would be awarded, without writing.')
        parser.add_argument('--overwrite', action='store_true', help='Re-award even if badge already exists for this period.')

    def handle(self, *args, **options):
        dry_run   = options['dry_run']
        org_id    = options.get('org')
        overwrite = options['overwrite']

        # ── Resolve period key ────────────────────────────────────────
        period_key = options.get('period')
        if not period_key:
            today = date.today()
            # Use first day of current month minus 1 day → last month
            first_of_month = date(today.year, today.month, 1)
            prev = date(first_of_month.year, first_of_month.month - 1, 1) \
                if first_of_month.month > 1 \
                else date(first_of_month.year - 1, 12, 1)
            period_key = prev.strftime('%Y-%m')

        tag = f"[DRY-RUN] " if dry_run else ""
        self.stdout.write(f"WISE Badges: {tag}Awarding badges for period '{period_key}'")

        # ── Resolve employees ─────────────────────────────────────────
        summary_qs = EmployeeScoreSummary.objects.select_related('employee', 'employee__user')
        if org_id:
            summary_qs = summary_qs.filter(organization_id=org_id)

        created = skipped = errors = 0

        for summary in summary_qs.iterator(chunk_size=100):
            emp = summary.employee

            # Look up snapshot for this specific period; fall back to live summary
            period_snapshot = EmployeeScorePeriod.objects.filter(
                employee=emp,
                period_type='MONTHLY',
                period_key=period_key
            ).first()

            score = float(period_snapshot.global_score if period_snapshot else summary.global_score)
            badge = _resolve_badge(score)

            # Don't re-award unless --overwrite
            # Check by period only — badge type may change if score was recalculated
            already_awarded = EmployeeBadge.objects.filter(
                employee=emp,
                period_key=period_key
            ).exists()

            if already_awarded and not overwrite:
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(
                    f"  → {emp} | Score {score:.1f} | {BADGE_LABELS[badge]} | Period {period_key}"
                )
                created += 1
                continue

            try:
                EmployeeBadge.objects.update_or_create(
                    employee=emp,
                    period_key=period_key,
                    defaults={
                        'organization_id': emp.organization_id,
                        'badge_code': badge,
                        'badge_name': BADGE_LABELS[badge],
                        'reason': f"Auto-awarded for {period_key} performance (score: {score:.1f})",
                    }
                )
                # Update the live summary badge level
                summary.badge_level = badge
                summary.save(update_fields=['badge_level'])

                # Stamp the period snapshot too
                if period_snapshot and period_snapshot.badge_awarded != badge:
                    period_snapshot.badge_awarded = badge
                    period_snapshot.save(update_fields=['badge_awarded'])

                created += 1
            except Exception as exc:
                errors += 1
                self.stderr.write(f"  ERROR for {emp}: {exc}")

        # ── Emit event for downstream notifications ────────────────────
        if not dry_run and created:
            try:
                from kernel.events import emit_event
                emit_event('workforce.badges_awarded', {
                    'period_key': period_key,
                    'awarded_count': created,
                    'skipped_count': skipped,
                })
            except Exception:
                pass

        style = self.style.SUCCESS if not dry_run else self.style.WARNING
        self.stdout.write(style(
            f"WISE Badges: {'Preview' if dry_run else 'Complete'} — "
            f"{created} {'would be' if dry_run else ''} awarded, "
            f"{skipped} skipped (already have badge), {errors} errors."
        ))
