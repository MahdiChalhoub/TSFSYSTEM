"""
Daily/on-demand sync of `CurrencyRatePolicy` rows from external providers.

Run from cron:
    0 9 * * *  python manage.py sync_currency_rates

Flags:
    --org-id <uuid>    Restrict to one organization
    --all              Sync ALL active policies, not just auto_sync=True
    --policy-id <id>   Sync exactly one policy
"""
from __future__ import annotations

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Sync exchange rates from external providers per CurrencyRatePolicy.'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=str, default=None)
        parser.add_argument('--all', action='store_true',
                            help='Sync all active policies (ignore auto_sync flag).')
        parser.add_argument('--policy-id', type=int, default=None)

    def handle(self, *args, **opts):
        from erp.models import Organization
        from apps.finance.models import CurrencyRatePolicy
        from apps.finance.services import CurrencyRateSyncService

        if opts['policy_id']:
            try:
                policy = CurrencyRatePolicy.objects.select_related(
                    'from_currency', 'to_currency', 'organization',
                ).get(id=opts['policy_id'])
            except CurrencyRatePolicy.DoesNotExist:
                self.stderr.write(f"Policy {opts['policy_id']} not found.")
                return
            ok, msg = CurrencyRateSyncService.sync_pair(policy)
            style = self.style.SUCCESS if ok else self.style.ERROR
            self.stdout.write(style(f"[{policy.organization}] {msg}"))
            return

        org_qs = Organization.objects.all()
        if opts['org_id']:
            org_qs = org_qs.filter(id=opts['org_id'])

        only_auto = not opts['all']
        total_ok = total_fail = 0
        for org in org_qs:
            results = CurrencyRateSyncService.sync_org(org, only_auto=only_auto)
            if not results:
                self.stdout.write(self.style.WARNING(
                    f'[{org}] No {"auto-sync" if only_auto else "active"} policies.'
                ))
                continue
            for r in results:
                style = self.style.SUCCESS if r['ok'] else self.style.ERROR
                self.stdout.write(style(f"  [{org}] {r['message']}"))
                total_ok += 1 if r['ok'] else 0
                total_fail += 0 if r['ok'] else 1

        self.stdout.write(self.style.NOTICE(
            f'\nDone — {total_ok} OK, {total_fail} failed.'
        ))
