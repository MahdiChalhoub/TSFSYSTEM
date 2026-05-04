"""
Management command: recover_terminal_procurement
=================================================
Walks every organization, reads its procurement-recovery policy from
`Organization.settings['procurement_recovery_policy']`, and marks
procurement-request rows as `is_recovered=True` once their terminal-state
cooldown matures.

Recovered rows stay in the DB (audit trail intact) but are excluded from
"active" filters by the API and the request list page — so the product /
request chip naturally flips back to "Available".

Schedule via cron / celery-beat (recommended every 15 min):
    python manage.py recover_terminal_procurement [--apply] [--org=<slug>]

Without --apply: dry-run (logs what WOULD be recovered, no DB writes).
With --org: limit to one tenant (useful for testing).
"""
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone


# Mirrors the canonical PipelineRecoveryPolicy on the frontend
# (src/lib/procurement-status.ts → DEFAULT_RECOVERY_POLICY). Same
# defaults — admin can override per-tenant via /settings/procurement-recovery
# which writes Organization.settings['procurement_recovery_policy'].
DEFAULT_POLICY = {
    'RECEIVED':  {'autoRecoverAfterDays': 0},
    'CANCELLED': {'autoRecoverAfterDays': 7},
    'REJECTED':  {
        'autoRecoverAfterDays': 30,
        'perReasonDays': {
            'NO_STOCK':       3,
            'PRICE_HIGH':     14,
            'NEEDS_REVISION': 3,
            'DAMAGED':        None,
            'OTHER':          30,
        },
    },
    'FAILED':    {'autoRecoverAfterDays': None},
}

# Map ProcurementRequest.status → terminal-state key in the policy.
# REJECTED/CANCELLED/FAILED are the terminals we care about.
TERMINAL_STATUSES = {'REJECTED': 'REJECTED', 'CANCELLED': 'CANCELLED', 'FAILED': 'FAILED'}


def _resolve_cooldown(policy, terminal_key, rejection_reason=None):
    """Return cooldown in days for a (terminal, reason) pair, or None
    if the row should never auto-recover."""
    rule = policy.get(terminal_key) or {}
    days = rule.get('autoRecoverAfterDays')
    # Per-reason override (REJECTED only)
    if terminal_key == 'REJECTED' and rejection_reason:
        per_reason = rule.get('perReasonDays') or {}
        if rejection_reason in per_reason:
            days = per_reason[rejection_reason]
    return days


def _merge_policy(stored, defaults=DEFAULT_POLICY):
    """Shallow-merge a per-tenant policy with the defaults so a partial
    override still works."""
    if not isinstance(stored, dict):
        return defaults
    merged = {}
    for key, default_rule in defaults.items():
        merged[key] = {**default_rule, **(stored.get(key) or {})}
        if key == 'REJECTED':
            merged[key]['perReasonDays'] = {
                **(default_rule.get('perReasonDays') or {}),
                **((stored.get(key) or {}).get('perReasonDays') or {}),
            }
    return merged


class Command(BaseCommand):
    help = (
        'Auto-recover (archive) procurement requests that have aged past '
        'their terminal-state cooldown. Reads per-tenant policy from '
        'Organization.settings.procurement_recovery_policy.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Persist the recovery (default: dry-run).')
        parser.add_argument('--org', type=str, default=None,
                            help='Limit to one organization (slug).')

    def handle(self, *args, **options):
        from erp.models import Organization
        from apps.pos.models.procurement_request_models import ProcurementRequest

        apply = options['apply']
        org_slug = options['org']

        orgs = Organization.objects.all()
        if org_slug:
            orgs = orgs.filter(slug=org_slug)

        total_seen = 0
        total_recovered = 0
        now = timezone.now()

        for org in orgs:
            stored = (org.settings or {}).get('procurement_recovery_policy')
            policy = _merge_policy(stored)

            # Pull every terminal request that hasn't been recovered yet.
            qs = ProcurementRequest.objects.filter(
                organization=org,
                status__in=list(TERMINAL_STATUSES.keys()),
                is_recovered=False,
            )
            org_seen = 0
            org_recovered = 0
            for req in qs:
                org_seen += 1
                key = TERMINAL_STATUSES[req.status]
                # Reason category is parsed out of `[CATEGORY] free text`
                # in the rejection_reason field on the PO model. The
                # ProcurementRequest doesn't have a reason field, so
                # for now we only honor the top-level cooldown.
                days = _resolve_cooldown(policy, key, rejection_reason=None)
                if days is None:
                    continue   # never auto-recover
                # Use reviewed_at as the terminal-state entry time;
                # fall back to requested_at for legacy rows.
                terminal_since = req.reviewed_at or req.requested_at
                if not terminal_since:
                    continue
                age_days = (now - terminal_since).total_seconds() / 86400
                if age_days < days:
                    continue
                org_recovered += 1
                total_recovered += 1
                self.stdout.write(
                    f"  org={org.slug} req#{req.id} {req.status:9s} "
                    f"age={age_days:6.1f}d cooldown={days}d → RECOVER"
                )
                if apply:
                    req.is_recovered = True
                    req.recovered_at = now
                    req.save(update_fields=['is_recovered', 'recovered_at'])
            total_seen += org_seen
            if org_seen:
                mode = 'APPLIED' if apply else 'DRY-RUN'
                self.stdout.write(
                    f"  [{org.slug}] {org_recovered}/{org_seen} terminal rows "
                    f"matured ({mode})"
                )

        self.stdout.write(self.style.SUCCESS(
            f"\nTotal: {total_recovered}/{total_seen} marked"
            f"{' (dry-run — pass --apply to persist)' if not apply else ''}"
        ))
