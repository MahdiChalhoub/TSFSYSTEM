"""
Seed Feature Flags
==================
Seeds default feature flags for all organizations (or a specific one).

Usage:
    python manage.py seed_feature_flags
    python manage.py seed_feature_flags --org=my-org-slug
    python manage.py seed_feature_flags --reset  # Force reset to defaults
"""

from django.core.management.base import BaseCommand
from erp.models import Organization


class Command(BaseCommand):
    help = 'Seed default feature flags for organizations'

    def add_arguments(self, parser):
        parser.add_argument('--org', type=str, help='Specific organization slug')
        parser.add_argument('--reset', action='store_true', help='Reset all flags to defaults')

    def handle(self, *args, **options):
        from apps.core.feature_flags import seed_feature_flags

        org_slug = options.get('org')
        force_reset = options.get('reset', False)

        if org_slug:
            orgs = Organization.objects.filter(slug=org_slug)
            if not orgs.exists():
                self.stderr.write(f"❌ Organization not found: {org_slug}")
                return
        else:
            orgs = Organization.objects.filter(is_active=True)

        self.stdout.write(f"🚀 Seeding feature flags for {orgs.count()} organization(s)...")

        total = {'created': 0, 'updated': 0, 'skipped': 0}
        for org in orgs:
            result = seed_feature_flags(org, force_reset=force_reset)
            for k in total:
                total[k] += result[k]
            self.stdout.write(f"  ✅ {org.name}: {result}")

        self.stdout.write(self.style.SUCCESS(
            f"\n🏁 Done — {total['created']} created, {total['updated']} updated, {total['skipped']} skipped"
        ))
