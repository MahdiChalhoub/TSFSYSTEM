"""Test ONLY inventory URL registration."""
import os, sys, logging
logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

# Replicate what erp/urls.py does for inventory
import importlib
from django.urls import path, include

print("=== Step 1: Import inventory urls ===")
try:
    mod = importlib.import_module('apps.inventory.urls')
    print(f"OK, {len(mod.urlpatterns)} url patterns")
    for p in mod.urlpatterns[:5]:
        print(f"  {p}")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

print("\n=== Step 2: Try flat include ===")
try:
    flat = path('', include('apps.inventory.urls'))
    print(f"OK: {flat}")
except Exception as e:
    print(f"FAILED: {e}")

print("\n=== Step 3: Try namespaced include ===")
try:
    ns = path('inventory/', include('apps.inventory.urls'))
    print(f"OK: {ns}")
except Exception as e:
    print(f"FAILED: {e}")

print("\n=== Step 4: Check erp/urls.py registration ===")
from erp.urls import urlpatterns
inv_patterns = [p for p in urlpatterns if hasattr(p, 'pattern') and 'inventory' in str(p.pattern)]
print(f"Inventory-related patterns: {len(inv_patterns)}")
for p in inv_patterns:
    print(f"  {p}")
    
# Check if format suffix converter already registered
print("\n=== Step 5: Check registered URL converters ===")
from django.urls.converters import REGISTERED_CONVERTERS
for name, conv in REGISTERED_CONVERTERS.items():
    print(f"  {name}: {conv}")
