"""
Seed Roles Management Command

Creates default roles for all tenants.

Usage:
    python manage.py seed_roles
    python manage.py seed_roles --tenant=acme  # Specific tenant
"""

from django.core.management.base import BaseCommand
from erp.models import Organization as Tenant
from kernel.rbac.models import Role, Permission


class Command(BaseCommand):
    help = 'Seed default roles for tenants'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=str,
            help='Specific tenant slug (if not provided, seeds for all tenants)'
        )

    def handle(self, *args, **options):
        tenant_slug = options.get('tenant')

        if tenant_slug:
            tenants = Tenant.objects.filter(slug=tenant_slug, is_active=True)
            if not tenants.exists():
                self.stdout.write(self.style.ERROR(f"Tenant not found: {tenant_slug}"))
                return
        else:
            tenants = Tenant.objects.filter(is_active=True)

        for tenant in tenants:
            self.stdout.write(f"\n📊 Seeding roles for tenant: {tenant.name} ({tenant.slug})")
            self.seed_tenant_roles(tenant)

        self.stdout.write(self.style.SUCCESS(f"\n✅ Roles seeded for {tenants.count()} tenant(s)"))

    def seed_tenant_roles(self, tenant):
        """Seed roles for a specific tenant."""

        # 1. System Administrator
        admin_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='System Administrator',
            defaults={
                'description': 'Full system access - all permissions',
                'is_system_role': True
            }
        )
        admin_role.permissions.set(Permission.objects.all())
        self._log_role(admin_role, created)

        # 2. Finance Manager
        finance_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='Finance Manager',
            defaults={
                'description': 'Full finance module access',
                'is_system_role': True
            }
        )
        finance_perms = Permission.objects.filter(module='finance')
        finance_role.permissions.set(finance_perms)
        self._log_role(finance_role, created)

        # 3. Accountant
        accountant_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='Accountant',
            defaults={
                'description': 'Finance access without dangerous permissions',
                'is_system_role': True
            }
        )
        accountant_perms = Permission.objects.filter(
            module='finance',
            is_dangerous=False
        )
        accountant_role.permissions.set(accountant_perms)
        self._log_role(accountant_role, created)

        # 4. Inventory Manager
        inventory_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='Inventory Manager',
            defaults={
                'description': 'Full inventory module access',
                'is_system_role': True
            }
        )
        inventory_perms = Permission.objects.filter(module='inventory')
        inventory_role.permissions.set(inventory_perms)
        self._log_role(inventory_role, created)

        # 5. Sales Manager
        sales_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='Sales Manager',
            defaults={
                'description': 'Sales and CRM access',
                'is_system_role': True
            }
        )
        sales_perms = Permission.objects.filter(module__in=['sales', 'crm'])
        sales_role.permissions.set(sales_perms)
        self._log_role(sales_role, created)

        # 6. Cashier
        cashier_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='Cashier',
            defaults={
                'description': 'POS operations only',
                'is_system_role': True
            }
        )
        cashier_perms = Permission.objects.filter(
            code__in=[
                'pos.open_register',
                'pos.close_register',
                'pos.process_sale',
                'pos.apply_discount',
            ]
        )
        cashier_role.permissions.set(cashier_perms)
        self._log_role(cashier_role, created)

        # 7. HR Manager
        hr_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='HR Manager',
            defaults={
                'description': 'Human resources management',
                'is_system_role': True
            }
        )
        hr_perms = Permission.objects.filter(module='hr')
        hr_role.permissions.set(hr_perms)
        self._log_role(hr_role, created)

        # 8. Procurement Manager
        procurement_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='Procurement Manager',
            defaults={
                'description': 'Purchase orders and supplier management',
                'is_system_role': True
            }
        )
        procurement_perms = Permission.objects.filter(module='procurement')
        procurement_role.permissions.set(procurement_perms)
        self._log_role(procurement_role, created)

        # 9. Store Clerk
        clerk_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='Store Clerk',
            defaults={
                'description': 'Basic inventory and POS access',
                'is_system_role': True
            }
        )
        clerk_perms = Permission.objects.filter(
            code__in=[
                'inventory.view_product',
                'pos.process_sale',
                'crm.view_customer',
            ]
        )
        clerk_role.permissions.set(clerk_perms)
        self._log_role(clerk_role, created)

        # 10. Auditor (Read-Only)
        auditor_role, created = Role.objects.get_or_create(
            tenant=tenant,
            name='Auditor',
            defaults={
                'description': 'Read-only access to all modules',
                'is_system_role': True
            }
        )
        auditor_perms = Permission.objects.filter(code__contains='view')
        auditor_role.permissions.set(auditor_perms)
        self._log_role(auditor_role, created)

    def _log_role(self, role, created):
        """Log role creation/update."""
        if created:
            self.stdout.write(self.style.SUCCESS(f"  ✓ Created: {role.name} ({role.permissions.count()} permissions)"))
        else:
            self.stdout.write(f"  → Updated: {role.name} ({role.permissions.count()} permissions)")
