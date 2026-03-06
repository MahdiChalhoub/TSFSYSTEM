"""
Enable Module Management Command

Enables a module for a tenant.

Usage:
    python manage.py enable_module inventory --tenant=acme
    python manage.py enable_module inventory --all-tenants
"""

from django.core.management.base import BaseCommand
from kernel.modules import ModuleLoader
from erp.models import Organization as Tenant


class Command(BaseCommand):
    help = 'Enable module for tenant(s)'

    def add_arguments(self, parser):
        parser.add_argument(
            'module_name',
            type=str,
            help='Module name to enable'
        )
        parser.add_argument(
            '--tenant',
            type=str,
            help='Tenant slug'
        )
        parser.add_argument(
            '--all-tenants',
            action='store_true',
            help='Enable for all active tenants'
        )

    def handle(self, *args, **options):
        module_name = options['module_name']
        tenant_slug = options.get('tenant')
        all_tenants = options.get('all_tenants')

        if not tenant_slug and not all_tenants:
            self.stdout.write(self.style.ERROR(
                'Please specify --tenant=SLUG or --all-tenants'
            ))
            return

        # Get tenants
        if all_tenants:
            tenants = Tenant.objects.filter(is_active=True)
        else:
            tenants = Tenant.objects.filter(slug=tenant_slug, is_active=True)

        if not tenants.exists():
            self.stdout.write(self.style.ERROR(f"No tenants found"))
            return

        self.stdout.write(f"🔄 Enabling module '{module_name}' for {tenants.count()} tenant(s)...\n")

        enabled_count = 0
        failed_count = 0

        for tenant in tenants:
            try:
                org_module = ModuleLoader.enable_for_tenant(tenant, module_name)
                self.stdout.write(self.style.SUCCESS(
                    f"  ✅ {tenant.name}: {module_name} v{org_module.module.version}"
                ))
                enabled_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"  ❌ {tenant.name}: {str(e)}"
                ))
                failed_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Enabled for {enabled_count} tenant(s), {failed_count} failed"
        ))
