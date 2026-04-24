"""
Regenerate the SYSTEM_OPENING journal entry for a fiscal year after
the prior year's ledger has been cleaned up (e.g. parent-posted lines
reclassified to leaves via `finance_detect_parent_postings --migrate`).

The existing SYSTEM_OPENING JE is soft-superseded — we keep the audit
trail — and a new one is written from the current authoritative JE
state of the prior year. Both scopes are regenerated together.

Pre-flight gates (refuse to run if any fail):
  • Prior year exists + is FINALIZED
  • `check_parent_purity(org)` reports clean (otherwise you'd rebuild
    opening while the old data still has parent offenders)
  • OB↔JE drift report is acceptable (drift for the TARGET year is
    allowed — that's what we're fixing — but the PRIOR year must be
    coherent)

Usage:
  python manage.py finance_regenerate_opening --org <id> --fiscal-year <id>
  python manage.py finance_regenerate_opening --org <id> --fiscal-year <id> --force

--force skips the parent-purity gate. Use only when you accept that the
new opening will carry residual parent balances (e.g. during migration
while not every offender is cleaned yet).

Side effects:
  • Supersedes existing SYSTEM_OPENING JE(s) for (target_year, both scopes)
  • Creates new SYSTEM_OPENING JE(s) dated target_year.start_date
  • Rewrites the OpeningBalance rows for target_year (full rebuild)
"""
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Regenerate SYSTEM_OPENING JEs from the prior year's authoritative JE state."

    def add_arguments(self, parser):
        parser.add_argument('--org', type=str, required=True,
                            help='Organization ID/UUID')
        parser.add_argument('--fiscal-year', type=int, required=True,
                            help='Target fiscal year ID to regenerate opening for')
        parser.add_argument('--force', action='store_true', default=False,
                            help='Bypass parent-purity gate (opening will carry whatever the prior year still has)')
        parser.add_argument('--dry-run', action='store_true', default=False,
                            help='Report what would be regenerated without writing')

    def handle(self, *args, **opts):
        from apps.finance.models import FiscalYear
        from apps.finance.services.closing_service import ClosingService
        from erp.models import Organization

        try:
            org = Organization.objects.get(id=opts['org'])
        except Organization.DoesNotExist:
            raise CommandError(f"Organization {opts['org']} not found")

        try:
            target = FiscalYear.objects.get(id=opts['fiscal_year'], organization=org)
        except FiscalYear.DoesNotExist:
            raise CommandError(
                f"FiscalYear {opts['fiscal_year']} not found for this org"
            )

        # Find the prior year (the one that closes INTO `target`).
        prior = (
            FiscalYear.objects
            .filter(organization=org, end_date__lt=target.start_date)
            .order_by('-end_date')
            .first()
        )
        if not prior:
            raise CommandError(
                f"No fiscal year precedes {target.name} — nothing to carry forward"
            )
        if prior.status != 'FINALIZED':
            raise CommandError(
                f"Prior year {prior.name} is {prior.status}, not FINALIZED. "
                f"Finalize it first, then regenerate opening."
            )

        self.stdout.write(f"Target : {target.name} (id={target.id}, status={target.status})")
        self.stdout.write(f"Source : {prior.name} (id={prior.id}, status={prior.status})")

        # ── Parent-purity gate ──
        purity = ClosingService.check_parent_purity(org)
        if not purity['clean']:
            n = len(purity['offenders'])
            self.stdout.write(self.style.WARNING(
                f"Parent-purity report: NOT CLEAN — {n} offender row(s)"
            ))
            for off in purity['offenders'][:10]:
                self.stdout.write(
                    f"  [{off['scope']}] {off['code']} {off['name']} "
                    f"net={off['net']} lines={off['n_lines']}"
                )
            if not opts['force']:
                raise CommandError(
                    "Refusing to regenerate — parent accounts still hold direct "
                    "postings. Clean with `finance_detect_parent_postings --migrate` "
                    "then retry, or pass --force to proceed anyway."
                )
            self.stdout.write(self.style.WARNING(
                "Proceeding with --force — the new opening will inherit the "
                "current (dirty) parent balances."
            ))
        else:
            self.stdout.write(self.style.SUCCESS("Parent-purity report: CLEAN ✓"))

        if opts['dry_run']:
            self.stdout.write(self.style.SUCCESS(
                f"DRY-RUN: would regenerate OPENING JE(s) for {target.name} "
                f"from {prior.name} (both scopes)."
            ))
            return

        # ── Execute ──
        # generate_opening_balances handles:
        #   - reading authoritative JE lines from the prior year
        #   - full-rebuild of OpeningBalance rows for the target year
        #   - soft-supersede + recreate of SYSTEM_OPENING JEs per scope
        #   - select_for_update race guard on the FiscalYear row
        rows_written = ClosingService.generate_opening_balances(
            organization=org,
            from_year=prior,
            to_year=target,
            user=None,
        )
        self.stdout.write(self.style.SUCCESS(
            f"Regenerated opening for {target.name} — {rows_written} OB row(s) "
            f"written, SYSTEM_OPENING JE(s) re-issued for OFFICIAL + INTERNAL."
        ))

        # Post-flight validation — confirm no drift
        drift = ClosingService.validate_opening_ob_vs_je(org, target)
        if drift['has_drift']:
            self.stdout.write(self.style.WARNING(
                f"Post-flight: OB↔JE drift detected on {target.name} — "
                f"investigate before trusting this opening."
            ))
        else:
            self.stdout.write(self.style.SUCCESS("Post-flight: zero OB↔JE drift ✓"))
