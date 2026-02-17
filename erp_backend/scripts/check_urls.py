"""Check which ViewSets can be imported from inventory views."""
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

# Try each import individually
names = [
    "ProductViewSet", "UnitViewSet", "WarehouseViewSet", "InventoryViewSet",
    "BrandViewSet", "CategoryViewSet", "ParfumViewSet", "ProductGroupViewSet",
    "InventoryMovementViewSet",
    "StockAdjustmentOrderViewSet", "StockTransferOrderViewSet",
    "OperationalRequestViewSet", "ProductSerialViewSet", "SerialLogViewSet",
]

print("=== Testing inventory views imports ===")
try:
    from apps.inventory import views
    print("views module imported OK")
    for name in names:
        if hasattr(views, name):
            print(f"  OK: {name}")
        else:
            print(f"  MISSING: {name}")
except Exception as e:
    print(f"views import FAILED: {e}")

print("\n=== Testing inventory models ===")
try:
    from apps.inventory import models
    print("models module imported OK")
    model_names = [n for n in dir(models) if n[0].isupper() and not n.startswith('_')]
    print(f"  Available: {model_names}")
except Exception as e:
    print(f"models import FAILED: {e}")

print("\n=== Testing pos urls ===")
try:
    from apps.pos import urls
    print(f"pos urls OK, {len(urls.urlpatterns)} patterns")
except Exception as e:
    print(f"pos urls FAILED: {e}")

print("\n=== Testing ALL module urls ===")
from pathlib import Path
apps_dir = Path("/root/TSFSYSTEM/erp_backend/apps")
for d in sorted(apps_dir.iterdir()):
    if d.is_dir() and (d / "urls.py").exists():
        try:
            import importlib
            mod = importlib.import_module(f"apps.{d.name}.urls")
            n = len(getattr(mod, 'urlpatterns', []))
            print(f"  OK: {d.name} ({n} patterns)")
        except Exception as e:
            print(f"  FAIL: {d.name} - {str(e)[:100]}")
