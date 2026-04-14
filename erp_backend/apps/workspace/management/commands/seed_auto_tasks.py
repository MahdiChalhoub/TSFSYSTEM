"""
Management Command: seed_auto_tasks
====================================
Seeds 80+ default AutoTaskRules for an organization.

Usage:
    python manage.py seed_auto_tasks --org-slug=demo
    python manage.py seed_auto_tasks --org-id=1
    python manage.py seed_auto_tasks --all
"""
from django.core.management.base import BaseCommand, CommandError
from erp.models import Organization


class Command(BaseCommand):
    help = 'Seed default AutoTaskRules (80+ rules) for an organization.'

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument(
            '--org-slug', type=str,
            help='Slug of the organization to seed rules for'
        )
        group.add_argument(
            '--org-id', type=int,
            help='ID of the organization to seed rules for'
        )
        group.add_argument(
            '--all', action='store_true',
            help='Seed rules for ALL active organizations'
        )

    def handle(self, *args, **options):
        from apps.workspace.seed_auto_tasks import seed_auto_tasks

        if options['all']:
            orgs = Organization.objects.filter(is_active=True)
            if not orgs.exists():
                raise CommandError('No active organizations found.')

            total_created = 0
            total_skipped = 0
            for org in orgs:
                self.stdout.write(f'Seeding: {org.name} ({org.slug})...')
                created, skipped = seed_auto_tasks(org)
                total_created += created
                total_skipped += skipped
                self.stdout.write(
                    self.style.SUCCESS(f'  → {created} created, {skipped} skipped')
                )

            self.stdout.write(self.style.SUCCESS(
                f'\nTotal: {total_created} created, {total_skipped} skipped across {orgs.count()} org(s)'
            ))
        else:
            if options['org_slug']:
                try:
                    org = Organization.objects.get(slug=options['org_slug'])
                except Organization.DoesNotExist:
                    raise CommandError(f"Organization with slug '{options['org_slug']}' not found.")
            else:
                try:
                    org = Organization.objects.get(id=options['org_id'])
                except Organization.DoesNotExist:
                    raise CommandError(f"Organization with ID '{options['org_id']}' not found.")

            self.stdout.write(f'Seeding AutoTaskRules for: {org.name} ({org.slug})...')
            created, skipped = seed_auto_tasks(org)
            self.stdout.write(self.style.SUCCESS(
                f'Done: {created} created, {skipped} skipped'
            ))
