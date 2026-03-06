"""
List Modules Management Command

Lists registered modules and their status per tenant.

Usage:
    python manage.py list_modules
    python manage.py list_modules --tenant=acme
"""

from django.core.management.base import BaseCommand
from kernel.modules.models import KernelModule, OrgModule
from erp.models import Organization as Tenant


class Command(BaseCommand):
    help = 'List registered modules'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=str,
            help='Filter by tenant slug'
        )

    def handle(self, *args, **options):
        tenant_slug = options.get('tenant')

        if tenant_slug:
            self.list_for_tenant(tenant_slug)
        else:
            self.list_all_modules()

    def list_all_modules(self):
        """List all registered modules."""
        self.stdout.write("📦 Registered Modules\n")

        modules = KernelModule.objects.all().order_by('category', 'name')

        if not modules.exists():
            self.stdout.write("No modules registered")
            return

        current_category = None

        for module in modules:
            # Category header
            if module.category != current_category:
                current_category = module.category
                category_name = current_category or 'Other'
                self.stdout.write(f"\n{category_name.upper()}:")

            # Module info
            system_badge = " [SYSTEM]" if module.is_system_module else ""
            self.stdout.write(
                f"  • {module.name} v{module.version}{system_badge}"
            )
            self.stdout.write(f"    {module.description}")

            # Dependencies
            if module.depends_on:
                self.stdout.write(f"    Depends: {', '.join(module.depends_on)}")

    def list_for_tenant(self, tenant_slug: str):
        """List modules for specific tenant."""
        try:
            tenant = Tenant.objects.get(slug=tenant_slug, is_active=True)
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Tenant not found: {tenant_slug}"))
            return

        self.stdout.write(f"📦 Modules for {tenant.name}\n")

        # Get all modules with their org status
        modules = KernelModule.objects.all().order_by('name')

        if not modules.exists():
            self.stdout.write("No modules registered")
            return

        for module in modules:
            # Get org module status
            org_module = OrgModule.objects.filter(
                tenant=tenant,
                module=module
            ).first()

            if org_module:
                status = org_module.status
                version = org_module.installed_version
                status_symbol = "✅" if status == 'ENABLED' else "⏸️"
            else:
                status = "NOT INSTALLED"
                version = "-"
                status_symbol = "⬜"

            self.stdout.write(
                f"  {status_symbol} {module.name} v{version} [{status}]"
            )
