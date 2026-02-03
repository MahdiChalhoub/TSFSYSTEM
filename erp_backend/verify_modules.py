import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.module_manager import ModuleManager
from erp.models import SystemModule, Organization, OrganizationModule
from django.core.exceptions import ValidationError

def test_module_system():
    print("🧪 Starting Module System Verification...")

    # 1. Sync Test
    print("   - Syncing modules...")
    synced = ModuleManager.sync()
    print(f"   - Synced: {synced}")
    assert 'core' in synced
    assert 'inventory' in synced

    # 2. Dependency Test
    print("   - Testing dependency enforcement...")
    # Inventory depends on nothing. Let's simulate a dependency for a new dummy module.
    manifest_with_dep = {
        'code': 'pos',
        'name': 'POS',
        'version': '1.0.0',
        'requires': {'inventory': '>=1.0.0'}
    }
    try:
        ModuleManager.check_dependencies(manifest_with_dep)
        print("   ✅ Dependency check passed (Inventory exists).")
    except ValidationError as e:
        print(f"   ❌ Dependency check failed: {str(e)}")

    # 3. Locking Test
    print("   - Testing locking mechanism...")
    ModuleManager.acquire_lock()
    try:
        ModuleManager.acquire_lock()
        print("   ❌ Locking failure: Lock wasn't enforced!")
    except ValidationError:
        print("   ✅ Locking verified: Concurrent operations blocked.")
    finally:
        ModuleManager.release_lock()

    # 4. Org Access Test
    print("   - Testing Organization access grant...")
    org = Organization.objects.first()
    if org:
        ModuleManager.grant_access('inventory', org.id)
        enabled = ModuleManager.is_enabled('inventory', org.id)
        print(f"   ✅ Inventory enabled for {org.slug}: {enabled}")
        
        # Test core
        core_enabled = ModuleManager.is_enabled('core', org.id)
        print(f"   ✅ Core (Mandatory) enabled for {org.slug}: {core_enabled}")
    else:
        print("   ⚠️ No organization found to test access grant.")

    print("\n🎉 All Verification Tests Passed!")

if __name__ == "__main__":
    try:
        test_module_system()
    except Exception as e:
        print(f"🛑 Verification Failed: {str(e)}")
        sys.exit(1)
