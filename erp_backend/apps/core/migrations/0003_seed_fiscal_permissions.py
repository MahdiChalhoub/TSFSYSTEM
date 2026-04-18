from django.db import migrations


# (code, name, description, is_dangerous)
FISCAL_PERMISSIONS = [
    ('finance.view_fiscal_years',   'View fiscal years & periods',
     'List and inspect fiscal years, periods, summaries, history.', False),
    ('finance.view_journal',        'View journal entries',
     'Read journal entry details (used to gate draft-audit references).', False),
    ('finance.manage_fiscal_years', 'Manage fiscal years & periods',
     'Create/edit/delete fiscal years and periods; reopen periods.', True),
    ('finance.close_fiscal_year',   'Close & lock fiscal years',
     'Execute year-end close, lock/finalize years, soft/hard-lock periods.', True),
]


def seed(apps, schema_editor):
    KernelPermission = apps.get_model('apps_core', 'KernelPermission')
    for code, name, desc, dangerous in FISCAL_PERMISSIONS:
        KernelPermission.objects.update_or_create(
            code=code,
            defaults={
                'name': name, 'description': desc,
                'module': 'finance', 'is_dangerous': dangerous,
            },
        )


def unseed(apps, schema_editor):
    KernelPermission = apps.get_model('apps_core', 'KernelPermission')
    KernelPermission.objects.filter(code__in=[p[0] for p in FISCAL_PERMISSIONS]).delete()


def assign_to_existing_roles(apps, schema_editor):
    """
    Backfill the new fiscal permissions onto existing system roles per the
    seed_roles convention:
      - System Administrator → all 4
      - Finance Manager      → all 4
      - Accountant           → only non-dangerous (view_*)
    """
    KernelPermission = apps.get_model('apps_core', 'KernelPermission')
    Role = apps.get_model('apps_core', 'Role')

    perms_all = list(KernelPermission.objects.filter(
        code__in=[p[0] for p in FISCAL_PERMISSIONS]
    ))
    perms_safe = [p for p in perms_all if not p.is_dangerous]

    for role in Role.objects.filter(name__in=('System Administrator', 'Finance Manager')):
        role.permissions.add(*perms_all)
    for role in Role.objects.filter(name='Accountant'):
        role.permissions.add(*perms_safe)


def unassign_from_existing_roles(apps, schema_editor):
    KernelPermission = apps.get_model('apps_core', 'KernelPermission')
    Role = apps.get_model('apps_core', 'Role')
    perms = list(KernelPermission.objects.filter(
        code__in=[p[0] for p in FISCAL_PERMISSIONS]
    ))
    for role in Role.objects.filter(name__in=('System Administrator', 'Finance Manager', 'Accountant')):
        role.permissions.remove(*perms)


class Migration(migrations.Migration):

    dependencies = [
        ('apps_core', '0002_create_theme_models'),
    ]

    operations = [
        migrations.RunPython(seed, reverse_code=unseed),
        migrations.RunPython(assign_to_existing_roles, reverse_code=unassign_from_existing_roles),
    ]
