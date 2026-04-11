"""
Management command to seed auto-task rules for an organization.

Usage:
    python manage.py seed_auto_tasks                    # All organizations
    python manage.py seed_auto_tasks --org_id 1         # Specific organization
    python manage.py seed_auto_tasks --subdomain demo   # By subdomain
"""
from django.core.management.base import BaseCommand
from erp.models import Organization


class Command(BaseCommand):
    help = 'Seed default auto-task rules for organization(s)'

    def add_arguments(self, parser):
        parser.add_argument('--org_id', type=int, help='Organization ID')
        parser.add_argument('--subdomain', type=str, help='Organization subdomain')

    def handle(self, *args, **options):
        from apps.workspace.seed_auto_tasks import seed_auto_tasks

        org_id = options.get('org_id')
        subdomain = options.get('subdomain')

        if org_id:
            orgs = Organization.objects.filter(id=org_id)
        elif subdomain:
            orgs = Organization.objects.filter(subdomain=subdomain)
        else:
            orgs = Organization.objects.filter(is_active=True)

        if not orgs.exists():
            self.stdout.write(self.style.ERROR('No organizations found'))
            return

        for org in orgs:
            self.stdout.write(f'\n── Seeding: {org.name} (ID: {org.id}) ──')
            created, skipped = seed_auto_tasks(org)
            self.stdout.write(
                self.style.SUCCESS(f'   ✅ {created} rules created, {skipped} skipped (already exist)')
            )

        self.stdout.write(self.style.SUCCESS('\nDone!'))
