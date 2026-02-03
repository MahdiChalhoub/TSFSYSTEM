import os
import sys
import django

sys.path.append('c:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization

print("--- Available Workspaces ---")
orgs = Organization.objects.all()
if not orgs:
    print("No organizations found.")
else:
    for org in orgs:
        print(f"Name: {org.name} | Slug: {org.slug}")
print("----------------------------")
