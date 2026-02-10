import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from erp.module_manager import ModuleManager

module_name = 'demo'
try:
    print(f"Attempting to delete {module_name}...")
    ModuleManager.delete(module_name)
    print("Success!")
except Exception as e:
    import traceback
    print(f"Failed: {e}")
    traceback.print_exc()
