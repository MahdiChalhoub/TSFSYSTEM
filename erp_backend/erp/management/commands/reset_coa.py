"""
Management Command: reset_coa
Wipes all Chart of Accounts data for an organization and re-applies the IFRS_COA template.
Usage: python manage.py reset_coa <org_slug> [--template IFRS_COA]
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = 'Wipe all COA data for an organization and re-apply a clean template (default: IFRS_COA)'

    def add_arguments(self, parser):
        parser.add_argument('org_slug', type=str, help='Organization slug (e.g., "saas")')
        parser.add_argument(
            '--template',
            type=str,
            default='IFRS_COA',
            help='COA template key to apply (default: IFRS_COA). Options: IFRS_COA, LEBANESE_PCN, FRENCH_PCG, USA_GAAP, SYSCOHADA_REVISED'
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Skip confirmation prompt (for scripts/CI)'
        )

    def handle(self, *args, **options):
        from erp.models import Organization
        from apps.finance.models import COATemplate

        # Import finance models — gated for safety
        try:
            from apps.finance.models import ChartOfAccount, FinancialAccount, JournalEntry, JournalEntryLine
            from apps.finance.services import LedgerService, FinancialAccountService
        except ImportError:
            raise CommandError("Finance module not installed. Cannot reset COA.")

        from erp.services import ConfigurationService

        slug = options['org_slug']
        template_key = options['template']

        # Validate template exists in database
        available = list(COATemplate.objects.values_list('key', flat=True))
        if template_key not in available:
            raise CommandError(
                f"Template '{template_key}' not found in database. "
                f"Available: {', '.join(available)}. "
                f"Run: python manage.py seed_coa_templates"
            )

        # Find organization
        try:
            org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            raise CommandError(f"Organization with slug '{slug}' not found.")

        # Count existing data
        coa_count = ChartOfAccount.objects.filter(organization=org).count()
        fa_count = FinancialAccount.objects.filter(organization=org).count()
        je_count = JournalEntry.objects.filter(organization=org).count()
        jel_count = JournalEntryLine.objects.filter(organization=org).count()

        self.stdout.write(self.style.WARNING(
            f"\n{'='*60}\n"
            f"  RESET COA for: {org.name} ({org.slug})\n"
            f"  Template: {template_key}\n"
            f"{'='*60}\n"
            f"  Data to DELETE:\n"
            f"    - {coa_count} Chart of Account entries\n"
            f"    - {fa_count} Financial Accounts (Cash/Bank)\n"
            f"    - {je_count} Journal Entries\n"
            f"    - {jel_count} Journal Entry Lines\n"
            f"{'='*60}"
        ))

        if not options['confirm']:
            confirm = input("\nType 'DELETE' to confirm: ")
            if confirm != 'DELETE':
                self.stdout.write(self.style.ERROR("Aborted."))
                return

        with transaction.atomic():
            # 1. Delete Journal Entry Lines first (FK to COA)
            deleted_jel = JournalEntryLine.objects.filter(organization=org).delete()
            self.stdout.write(f"  [1/5] Deleted {deleted_jel[0]} Journal Entry Lines")

            # 2. Delete Journal Entries
            deleted_je = JournalEntry.objects.filter(organization=org).delete()
            self.stdout.write(f"  [2/5] Deleted {deleted_je[0]} Journal Entries")

            # 3. Delete Financial Accounts (PROTECT FK to COA)
            deleted_fa = FinancialAccount.objects.filter(organization=org).delete()
            self.stdout.write(f"  [3/5] Deleted {deleted_fa[0]} Financial Accounts")

            # 4. Delete ALL Chart of Accounts
            deleted_coa = ChartOfAccount.objects.filter(organization=org).delete()
            self.stdout.write(f"  [4/5] Deleted {deleted_coa[0]} Chart of Account entries")

            # 5. Re-apply clean template
            self.stdout.write(f"  [5/5] Applying {template_key} template...")
            LedgerService.apply_coa_template(org, template_key, reset=False)

            # 6. Re-create default Financial Account (Cash Drawer)
            from erp.models import Site
            main_site = Site.objects.filter(organization=org).first()
            if main_site:
                try:
                    FinancialAccountService.create_account(
                        organization=org,
                        name="Cash Drawer",
                        type="CASH",
                        currency="USD",
                        site_id=main_site.id
                    )
                    self.stdout.write("  [+] Re-created Cash Drawer financial account")
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  [!] Could not create Cash Drawer: {e}"))

            # 7. Re-wire posting rules
            ConfigurationService.apply_smart_posting_rules(org)
            self.stdout.write("  [+] Posting rules re-applied")

        # Final count
        new_count = ChartOfAccount.objects.filter(organization=org).count()
        self.stdout.write(self.style.SUCCESS(
            f"\n  SUCCESS! {template_key} applied cleanly.\n"
            f"  New COA has {new_count} accounts.\n"
        ))
