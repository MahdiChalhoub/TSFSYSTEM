#!/usr/bin/env python
"""
Quick script to add core.can_toggle_scope permission

Run this from Django shell or as a standalone script:
    python manage.py shell < add_scope_permission.py

Or directly:
    python add_scope_permission.py
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')
django.setup()

from kernel.rbac.models import Permission

def add_permission():
    """Add the core.can_toggle_scope permission."""

    try:
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
            print('✅ Permission created successfully!')
            print(f'   Code: {permission.code}')
            print(f'   Name: {permission.name}')
            print('')
            print('Next steps:')
            print('1. Assign this permission to roles that need to toggle scopes')
            print('2. Users with this permission will see the toggle in sidebar')
            print('3. Users without it will use the organization\'s default scope')
        else:
            print('ℹ️  Permission already exists')
            print(f'   Code: {permission.code}')
            print(f'   Name: {permission.name}')

        return permission

    except Exception as e:
        print(f'❌ Error creating permission: {e}')
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    add_permission()
