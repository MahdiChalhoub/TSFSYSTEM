import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from erp.models import SystemModule, OrganizationModule

print("--- SystemModules ---")
for m in SystemModule.objects.all():
    print(f"Name: {m.name}, Code: {m.manifest.get('code')}")

print("\n--- OrganizationModules (Active) ---")
for om in OrganizationModule.objects.filter(is_enabled=True):
    print(f"Org: {om.organization.slug}, Module: {om.module_name}")
