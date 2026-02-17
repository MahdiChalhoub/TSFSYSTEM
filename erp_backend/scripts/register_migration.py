"""Register the migration module in SystemModule and enable for all orgs."""
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

from erp.models import SystemModule, OrganizationModule, Organization

# 1. Create SystemModule
manifest = {
    "code": "migration",
    "name": "Import from Third Party",
    "version": "1.1.0",
    "description": "Import data from UltimatePOS and other third-party systems into TSF.",
    "category": "first-party",
    "isolation": "shared",
    "icon": "Globe",
    "routes": ["/migration/*"],
    "permissions": ["read:migration", "write:migration"],
    "dependencies": ["inventory", "pos", "crm", "finance"],
    "backendApp": "apps.migration"
}

mod, created = SystemModule.objects.get_or_create(
    name='migration',
    defaults={
        'version': '1.1.0',
        'status': 'INSTALLED',
        'visibility': 'public',
        'description': 'Import data from UltimatePOS and other third-party systems into TSF.',
        'icon': 'Globe',
        'manifest': manifest,
        'checksum': 'migration-v1.1.0',
    }
)
print(f"SystemModule 'migration': {'CREATED' if created else 'EXISTS'} (id={mod.id})")

# 2. Enable for all orgs
orgs = Organization.objects.all()
for org in orgs:
    om, om_created = OrganizationModule.objects.get_or_create(
        organization=org,
        module_name='migration',
        defaults={'is_enabled': True}
    )
    status = 'CREATED' if om_created else ('ALREADY ENABLED' if om.is_enabled else 'RE-ENABLED')
    if not om_created and not om.is_enabled:
        om.is_enabled = True
        om.save()
    print(f"  Org '{org.name}': {status}")

print("Done!")
