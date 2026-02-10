import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from erp.models import SystemModule

module_name = 'demo'
dependents = []
all_mods = SystemModule.objects.exclude(name=module_name)
for mod in all_mods:
    requires = mod.manifest.get('dependencies', [])
    if module_name in requires:
        dependents.append(mod.name)

print(f"Dependents of {module_name}: {dependents}")
