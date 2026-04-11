"""
Management command: seed_sales_permissions
==========================================
Idempotent — safe to run multiple times.
Creates all SALES_PERMISSION_CODES in the Permission table and
assigns them to bootstrap roles (SALES_CLERK, SALES_MANAGER, ACCOUNTANT, ADMIN)
for every active organization.

Usage:
    python manage.py seed_sales_permissions
    python manage.py seed_sales_permissions --org <slug>
"""
from django.core.management.base import BaseCommand
from erp.models import Organization


class Command(BaseCommand):
    help = 'Seed sales permission codes and bootstrap roles for all organizations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--org', type=str, default=None,
            help='Limit to a single organization slug (default: all active orgs)'
        )

    def handle(self, *args, **options):
        from apps.pos.services.permission_service import SalesPermissionService

        orgs = Organization.objects.filter(is_active=True)
        if options['org']:
            orgs = orgs.filter(slug=options['org'])
            if not orgs.exists():
                self.stderr.write(self.style.ERROR(f"No active org with slug '{options['org']}'"))
                return

        for org in orgs:
            result = SalesPermissionService.ensure_sales_permissions(org)
            self.stdout.write(
                self.style.SUCCESS(
                    f"[{org.slug}] "
                    f"Permissions created: {result['created_permissions'] or 'none (already existed)'} | "
                    f"Roles updated: {', '.join(result['roles_updated'])}"
                )
            )

        self.stdout.write(self.style.SUCCESS('Done.'))
