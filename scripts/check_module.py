import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from erp.models import OrganizationModule, SystemModule

module_name = 'demo'
count = OrganizationModule.objects.filter(module_name=module_name, is_enabled=True).count()
print(f"Active installs for {module_name}: {count}")

try:
    mod = SystemModule.objects.get(name=module_name)
    print(f"Module {module_name} status: {mod.status}")
except Exception as e:
    print(f"Error finding module: {e}")
