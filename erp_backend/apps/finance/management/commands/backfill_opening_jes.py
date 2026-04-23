"""
backfill_opening_jes — Create OPENING journal entries for every fiscal
year that has OpeningBalance rows but no corresponding OPENING JE.

Part of Phase 2 of the OB → JE unification migration. Safe to re-run —
idempotent per (fiscal_year, scope). Does NOT touch the OpeningBalance
table; the two systems dual-write during the transition.

Usage:
  # Single org by slug
  python manage.py backfill_opening_jes --org acme

  # Single org by id
  python manage.py backfill_opening_jes --org-id 42

  # All orgs (careful — runs sequentially)
  python manage.py backfill_opening_jes --all

  # Preview without writing
  python manage.py backfill_opening_jes --org acme --dry-run
"""
from django.core.management.base import BaseCommand, CommandError
from erp.models import Organization
from apps.finance.services.closing_service import ClosingService


class Command(BaseCommand):
    help = 'Backfill OPENING journal entries from existing OpeningBalance rows (idempotent).'

    def add_arguments(self, parser):
        parser.add_argument('--org', help='Organization slug')
        parser.add_argument('--org-id', type=int, help='Organization ID')
        parser.add_argument('--all', action='store_true', help='Process all organizations')
        parser.add_argument('--dry-run', action='store_true', help='Report what would be created without writing')
        parser.add_argument('--force', action='store_true',
            help='Regenerate OPENING JEs even if one already exists (soft-supersedes the old one)')
        parser.add_argument('--validate', action='store_true',
            help='Dual-read check only: compare OB vs OPENING JE per fiscal year and report drift')

    def handle(self, *args, **options):
        if options['all']:
            orgs = list(Organization.objects.all())
        elif options.get('org_id'):
            orgs = [Organization.objects.get(id=options['org_id'])]
        elif options.get('org'):
            orgs = [Organization.objects.get(slug=options['org'])]
        else:
            raise CommandError('Specify --org, --org-id, or --all')

        dry = options['dry_run']
        validate_only = options['validate']
        total_created = 0
        total_skipped = 0
        total_drift = 0

        for org in orgs:
            self.stdout.write(self.style.NOTICE(f'\n── {org.slug} (id={org.id}) ──'))

            if validate_only:
                from apps.finance.models import FiscalYear
                for fy in FiscalYear.objects.filter(organization=org).order_by('start_date'):
                    rpt = ClosingService.validate_opening_ob_vs_je(org, fy)
                    if rpt['has_drift']:
                        total_drift += 1
                        self.stdout.write(self.style.WARNING(
                            f'  DRIFT {fy.name}: ' + ', '.join(
                                f"{s}={len(v['drifts'])} acc mismatches (OB sum={v['ob_sum']}, JE sum={v['je_sum']})"
                                for s, v in rpt['scopes'].items()
                            )
                        ))
                        for scope, data in rpt['scopes'].items():
                            for d in data['drifts'][:5]:
                                self.stdout.write(
                                    f'    [{scope}] account_id={d["account_id"]} '
                                    f'OB={d["ob_net"]} JE={d["je_net"]} diff={d["diff"]}'
                                )
                    else:
                        self.stdout.write(self.style.SUCCESS(f'  OK    {fy.name} — OB and OPENING JE agree'))
                continue

            report = ClosingService.backfill_opening_journal_entries(
                organization=org, dry_run=dry, force=options['force'],
            )
            for d in report['details']:
                label = d.get('fy_name') or f'fy_id={d.get("fy_id")}'
                if d.get('skipped_reason'):
                    self.stdout.write(f'  SKIP  {label} ({d["scope"]}): {d["skipped_reason"]}')
                elif dry:
                    self.stdout.write(f'  WOULD {label} ({d["scope"]}): {d.get("would_create_lines", 0)} lines')
                else:
                    self.stdout.write(self.style.SUCCESS(
                        f'  OK    {label} ({d["scope"]}): JE #{d["je_id"]}, {d["lines"]} lines'
                    ))
            total_created += report['scopes_created']
            total_skipped += report['scopes_skipped']
            self.stdout.write(
                f'  summary: years={report["years_processed"]}, '
                f'created={report["scopes_created"]}, skipped={report["scopes_skipped"]}'
            )

        verb = 'would create' if dry else 'created'
        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {verb} {total_created} OPENING JEs across {len(orgs)} org(s). '
            f'Skipped {total_skipped}.'
        ))
