"""
Seed Scope Toggle Permission

Creates the core.can_toggle_scope permission for controlling access
to the Internal/Official scope toggle in the sidebar.

Usage:
    python manage.py seed_scope_permission
"""

from django.core.management.base import BaseCommand
from kernel.rbac.models import Permission


class Command(BaseCommand):
    help = 'Seeds the core.can_toggle_scope permission for dual-view toggle access control'

    def handle(self, *args, **options):
        """Create the scope toggle permission if it doesn't exist."""

        permission, created = Permission.objects.get_or_create(
            code='core.can_toggle_scope',
            defaults={
                'name': 'Can Toggle Scope (Internal/Official)',
                'description': (
                    'Allows user to switch between Internal and Official data views '
                    'using the sidebar toggle. Users without this permission will '
                    'see the default scope configured by their organization.'
                ),
                'module': 'core',
                'is_dangerous': False
            }
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS('✅ Permission created: core.can_toggle_scope')
            )
            self.stdout.write(
                self.style.SUCCESS(
                    '   You can now assign this permission to roles that need '
                    'to switch between Internal/Official views.'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING('⚠️  Permission already exists: core.can_toggle_scope')
            )

        # Show permission details
        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('Permission Details:'))
        self.stdout.write(f'  Code: {permission.code}')
        self.stdout.write(f'  Name: {permission.name}')
        self.stdout.write(f'  Module: {permission.module}')
        self.stdout.write(f'  Dangerous: {permission.is_dangerous}')
