"""
Management command: seed_test_register
Creates a POS register for testing purposes.
Uses the first available organization, warehouse, and financial accounts.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Create a POS register for testing (uses first available org + warehouse)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--name', type=str, default='Test Register 1',
            help='Name of the register (default: "Test Register 1")'
        )
        parser.add_argument(
            '--org-id', type=int, default=None,
            help='Organization ID to use (default: first available)'
        )
        parser.add_argument(
            '--branch-id', type=int, default=None,
            help='Branch/Warehouse ID to use (default: first available)'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from erp.models import Organization, User
        from apps.inventory.models import Warehouse
        from apps.pos.models import POSRegister

        register_name = options['name']

        # ── 1. Resolve Organization ──
        if options['org_id']:
            try:
                org = Organization.objects.get(id=options['org_id'])
            except Organization.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"Organization {options['org_id']} not found"))
                return
        else:
            org = Organization.objects.first()
            if not org:
                self.stderr.write(self.style.ERROR("No organizations found. Create one first."))
                return

        self.stdout.write(f"  Organization: {org.name} (id={org.id})")

        # ── 2. Resolve Branch (Warehouse) ──
        if options['branch_id']:
            try:
                branch = Warehouse.objects.get(id=options['branch_id'], organization=org)
            except Warehouse.DoesNotExist:
                self.stderr.write(self.style.ERROR(
                    f"Warehouse {options['branch_id']} not found for org {org.id}"
                ))
                return
        else:
            branch = Warehouse.objects.filter(organization=org).first()
            if not branch:
                self.stdout.write(self.style.WARNING(
                    "  No warehouses found — creating a default branch..."
                ))
                branch = Warehouse.objects.create(
                    organization=org,
                    name='Main Branch',
                    code='MAIN',
                    is_active=True,
                )
                self.stdout.write(self.style.SUCCESS(
                    f"  Created warehouse: {branch.name} (id={branch.id})"
                ))

        self.stdout.write(f"  Branch: {branch.name} (id={branch.id})")

        # ── 3. Check for duplicate ──
        existing = POSRegister.objects.filter(
            organization=org, name=register_name, branch=branch
        ).first()
        if existing:
            self.stdout.write(self.style.WARNING(
                f"\n  Register '{register_name}' already exists at {branch.name} "
                f"(id={existing.id}). Skipping creation."
            ))
            self._print_summary(existing)
            return

        # ── 4. Find cash account (optional) ──
        cash_account = None
        try:
            from apps.finance.models import FinancialAccount
            cash_account = FinancialAccount.objects.filter(
                organization=org,
                account_type='CASH',
                is_active=True,
            ).first()
            if not cash_account:
                # Try any asset account
                cash_account = FinancialAccount.objects.filter(
                    organization=org,
                    is_active=True,
                ).first()
            if cash_account:
                self.stdout.write(f"  Cash Account: {cash_account.name} (id={cash_account.id})")
            else:
                self.stdout.write(self.style.WARNING("  No financial accounts found — register will have no cash account"))
        except Exception:
            self.stdout.write(self.style.WARNING("  Finance module not available — skipping cash account"))

        # ── 5. Build default payment methods ──
        payment_methods = [
            {'key': 'cash', 'label': 'Espèces', 'accountId': cash_account.id if cash_account else None},
            {'key': 'wave', 'label': 'Wave', 'accountId': None},
            {'key': 'om', 'label': 'Orange Money', 'accountId': None},
            {'key': 'card', 'label': 'Carte Bancaire', 'accountId': None},
        ]

        # ── 6. Create the register ──
        register = POSRegister.objects.create(
            organization=org,
            name=register_name,
            branch=branch,
            warehouse=branch,  # same as branch for testing
            cash_account=cash_account,
            is_active=True,
            opening_mode='STANDARD',
            cashier_can_see_software=True,
            payment_methods=payment_methods,
        )

        # ── 7. Authorize all org users ──
        org_users = User.objects.filter(organization=org)
        if org_users.exists():
            register.authorized_users.set(org_users)
            self.stdout.write(f"  Authorized {org_users.count()} user(s)")
        else:
            self.stdout.write(self.style.WARNING("  No users found for this org"))

        self.stdout.write(self.style.SUCCESS(
            f"\n  ✅ POS Register created successfully!"
        ))
        self._print_summary(register)

    def _print_summary(self, register):
        self.stdout.write(self.style.SUCCESS("\n  ═══════════════════════════════════"))
        self.stdout.write(self.style.SUCCESS(f"  Register:   {register.name}"))
        self.stdout.write(f"  ID:         {register.id}")
        self.stdout.write(f"  Branch:     {register.branch.name if register.branch else 'None'}")
        self.stdout.write(f"  Warehouse:  {register.warehouse.name if register.warehouse else 'None'}")
        self.stdout.write(f"  Cash Acct:  {register.cash_account.name if register.cash_account else 'None'}")
        self.stdout.write(f"  Active:     {register.is_active}")
        self.stdout.write(f"  Mode:       {register.opening_mode}")
        self.stdout.write(f"  Methods:    {len(register.payment_methods)} configured")
        self.stdout.write(f"  Users:      {register.authorized_users.count()}")
        self.stdout.write(self.style.SUCCESS("  ═══════════════════════════════════"))
