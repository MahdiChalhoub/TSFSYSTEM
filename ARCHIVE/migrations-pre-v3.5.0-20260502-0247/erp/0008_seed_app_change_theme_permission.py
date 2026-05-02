"""
Data migration: Seed app.change_theme permission.

This adds the 'app.change_theme' permission to the custom RBAC Permission
table, which is used by the frontend RBAC guard in AppThemeSelector /
AppThemeTrigger to gate the theme picker.

After running this migration, assign the permission to the appropriate
Role(s) via the admin panel or via the Roles UI in Settings → Roles.
Superusers bypass all permission checks automatically (no assignment needed).
"""
from django.db import migrations


def seed_theme_permission(apps, schema_editor):
    Permission = apps.get_model('erp', 'Permission')
    Permission.objects.get_or_create(
        code='app.change_theme',
        defaults={
            'name': 'Can change UI theme',
            'description': (
                'Allows the user to switch between visual themes in the '
                'TSFSYSTEM admin interface. When not granted, the theme '
                'selector is hidden and replaced with a read-only indicator.'
            ),
        }
    )


def remove_theme_permission(apps, schema_editor):
    Permission = apps.get_model('erp', 'Permission')
    Permission.objects.filter(code='app.change_theme').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0007_user_whatsapp_number'),
    ]

    operations = [
        migrations.RunPython(
            seed_theme_permission,
            reverse_code=remove_theme_permission,
        ),
    ]
