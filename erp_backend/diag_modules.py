
import os
import django
from django.db.models import Q

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization, OrganizationModule

orgs = Organization.objects.all()
for org in orgs:
    print(f"Org: {org.name} (ID: {org.id})")
    modules = OrganizationModule.objects.filter(organization=org, is_enabled=True)
    for m in modules:
        # Assuming OrganizationModule has a reference to SystemModule or a code field
        # Let's check what fields it has
        try:
            print(f"  - Enabled Module: {m.module.name} ({m.module.code})")
        except AttributeError:
             # Fallback to direct fields if module is not a FK
             print(f"  - Enabled Module: {m}")
