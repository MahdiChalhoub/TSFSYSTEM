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
        parser.add_argument('--flag-check', action='store_true',
            help='Cutover readiness gate — report whether USE_JE_OPENING can be safely flipped on this tenant')
        parser.add_argument('--rebuild-ob', action='store_true',
            help='Rebuild OpeningBalance rows from the authoritative OPENING JE. Use this to fix drift (JE is source of truth — NEVER rebuild JE from OB).')
        parser.add_argument('--fy', type=int,
            help='Limit --rebuild-ob to a single fiscal year by id (required for --rebuild-ob unless --all-years is set)')
        parser.add_argument('--all-years', action='store_true',
            help='Apply --rebuild-ob to every fiscal year of the target org(s)')

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
        flag_check = options['flag_check']
        rebuild_ob = options['rebuild_ob']
        fy_id = options.get('fy')
        all_years = options['all_years']
        total_created = 0
        total_skipped = 0
        total_drift = 0
        any_unsafe = False

        if rebuild_ob and not (fy_id or all_years):
            raise CommandError('--rebuild-ob requires either --fy <id> or --all-years')

        for org in orgs:
            self.stdout.write(self.style.NOTICE(f'\n── {org.slug} (id={org.id}) ──'))

            if rebuild_ob:
                from apps.finance.models import FiscalYear
                fy_qs = FiscalYear.objects.filter(organization=org).order_by('start_date')
                if fy_id:
                    fy_qs = fy_qs.filter(id=fy_id)
                for fy in fy_qs:
                    rpt = ClosingService.rebuild_ob_from_je(org, fy)
                    if rpt['skipped_reason']:
                        self.stdout.write(self.style.WARNING(
                            f'  SKIP  {fy.name}: {rpt["skipped_reason"]}'
                        ))
                    else:
                        self.stdout.write(self.style.SUCCESS(
                            f'  OK    {fy.name}: deleted {rpt["rows_deleted"]} old OB, '
                            f'wrote {rpt["rows_written"]} new OB across {rpt["scopes_rebuilt"]} scope(s)'
                        ))
                continue

            if flag_check:
                rpt = ClosingService.is_safe_to_flip_flag(org)
                if rpt['safe']:
                    self.stdout.write(self.style.SUCCESS(
                        f'  SAFE — {rpt["years_total"]} year(s), 0 drift, 0 missing JE. '
                        f'USE_JE_OPENING can be flipped for this tenant.'
                    ))
                else:
                    any_unsafe = True
                    self.stdout.write(self.style.ERROR(
                        f'  NOT SAFE — {rpt["years_total"]} year(s), '
                        f'{rpt["years_drift"]} with drift, '
                        f'{rpt["years_missing_je"]} scope(s) missing OPENING JE'
                    ))
                    for y in rpt['years']:
                        reasons = []
                        if y['has_drift']:
                            reasons.append('DRIFT')
                        for scope, c in y['coverage'].items():
                            if c['has_ob'] and not c['has_je']:
                                reasons.append(f'missing {scope} JE')
                            only_ob = c.get('only_in_ob') or []
                            only_je = c.get('only_in_je') or []
                            if only_ob:
                                reasons.append(f'{scope} OB has {len(only_ob)} extra accounts')
                            if only_je:
                                reasons.append(f'{scope} JE has {len(only_je)} extra accounts')
                        if reasons:
                            self.stdout.write(f'    - {y["fy_name"]}: {", ".join(reasons)}')
                continue

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

        if flag_check:
            if any_unsafe:
                self.stdout.write(self.style.ERROR(
                    '\nDone. At least one tenant is NOT safe to flip USE_JE_OPENING.'
                ))
                import sys
                sys.exit(1)
            self.stdout.write(self.style.SUCCESS(
                f'\nDone. All {len(orgs)} tenant(s) are safe to flip USE_JE_OPENING.'
            ))
            return

        verb = 'would create' if dry else 'created'
        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {verb} {total_created} OPENING JEs across {len(orgs)} org(s). '
            f'Skipped {total_skipped}.'
        ))
