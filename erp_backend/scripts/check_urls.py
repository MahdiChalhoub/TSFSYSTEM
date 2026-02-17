"""Get detailed inventory registration error"""
import os, sys, logging
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Set up logging to capture the warning 
logging.basicConfig(level=logging.DEBUG, stream=sys.stdout, format='%(levelname)s: %(message)s')

import django
django.setup()

# Now replicate the URL registration for inventory ONLY
from django.urls import path, include
import importlib

print("=== Importing inventory urls ===")
try:
    mod = importlib.import_module('apps.inventory.urls')
    print(f"Import OK, patterns: {len(mod.urlpatterns)}")
except Exception as e:
    print(f"Import FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n=== Including as flat mount ===")
try:
    p = path('', include('apps.inventory.urls'))
    print(f"OK: {p}")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()

print("\n=== Including as namespaced mount ===")
try:
    p = path('inventory/', include('apps.inventory.urls'))
    print(f"OK: {p}")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
