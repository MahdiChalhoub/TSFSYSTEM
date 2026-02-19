"""
ensure_platform - Idempotent bootstrap command for the SaaS platform.

Ensures the SaaS superadmin organization and superuser account always exist.
Safe to run multiple times — skips creation if they already exist.

Usage:
    python manage.py ensure_platform
    python manage.py ensure_platform --admin-password=MySecret123
"""
import os
from django.core.management.base import BaseCommand
from erp.models import Organization, User


class Command(BaseCommand):
    help = 'Ensures the SaaS platform organization and superadmin exist (idempotent)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin-password',
            type=str,
            default=None,
            help='Password for the superadmin (default: from DJANGO_SUPERUSER_PASSWORD env or "admin")'
        )
        parser.add_argument(
            '--org-name',
            type=str,
            default='Enterprise ERP',
            help='Name for the SaaS organization (default: "Enterprise ERP")'
        )

    def handle(self, *args, **options):
        org_name = options['org_name']
        password = options['admin_password'] or os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'admin')

        # ── 1. Ensure SaaS Organization ──────────────────────────────
        org, org_created = Organization.objects.get_or_create(
            slug='saas',
            defaults={
                'name': org_name,
                'is_active': True,
                'timezone': 'UTC',
            }
        )
        if org_created:
            self.stdout.write(self.style.SUCCESS(f'✅ Created SaaS organization: "{org.name}" (slug=saas, id={org.id})'))
        else:
            self.stdout.write(self.style.WARNING(f'ℹ️  SaaS organization already exists: "{org.name}" (slug=saas)'))

        # ── 2. Ensure Superadmin User ────────────────────────────────
        # Scope by BOTH username AND organization to avoid MultipleObjectsReturned
        # when multiple tenants each have a user named 'admin'.
        admin, user_created = User.objects.get_or_create(
            username='admin',
            organization=org,
            defaults={
                'is_superuser': True,
                'is_staff': True,
                'is_active': True,
            }
        )

        # Always ensure password is set (handles credential changes)
        admin.set_password(password)
        admin.organization = org
        admin.is_superuser = True
        admin.is_staff = True
        admin.is_active = True
        admin.save()

        if user_created:
            self.stdout.write(self.style.SUCCESS(f'✅ Created superadmin user: "admin" (linked to org: {org.slug})'))
        else:
            self.stdout.write(self.style.SUCCESS(f'✅ Superadmin credentials refreshed (org: {org.slug})'))

        # ── 3. Summary ──────────────────────────────────────────────
        self.stdout.write('')
        self.stdout.write('Platform Bootstrap Summary:')
        self.stdout.write(f'  Organization: {org.name} (slug={org.slug})')
        self.stdout.write(f'  Superadmin:   admin (superuser={admin.is_superuser})')
        self.stdout.write(f'  Status:       ✅ Ready')
