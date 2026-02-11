import os
import django
import sys

# Add backend to path
sys.path.append('C:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Override DB settings for local connection if needed
# but let's try with default first
try:
    django.setup()
    from erp.models import SystemModule
    from erp.module_manager import ModuleManager

    print("--- SYNCING MODULES ---")
    names = ModuleManager.sync()
    print(f"Synced modules: {names}")

    print("\n--- REGISTRY STATE ---")
    finance = SystemModule.objects.filter(name='finance').first()
    if finance:
        print(f"Code: {finance.name}")
        print(f"Version: {finance.version}")
        print(f"Status: {finance.status}")
        print(f"Manifest Version: {finance.manifest.get('version')}")
    else:
        print("Finance module not found in registry!")

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
