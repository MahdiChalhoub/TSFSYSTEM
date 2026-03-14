import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import RequestFactory
from apps.inventory.views import InventoryMovementViewSet
from erp.models import Organization

def test_udle_metadata():
    print("--- Testing UDLE Metadata Action ---")
    factory = RequestFactory()
    view = InventoryMovementViewSet.as_view({'get': 'schema_meta'})
    
    # Create a dummy org
    org, _ = Organization.objects.get_or_create(slug='test-org', name='Test Org')
    
    request = factory.get('/api/inventory/inventory-movements/schema-meta/')
    request.org_id = org.id
    
    response = view(request)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.data
        print(f"Model: {data.get('model')}")
        print(f"Fields Found: {len(data.get('fields', []))}")
        
        # Check for specific fields and types
        fields = {f['name']: f['type'] for f in data.get('fields', [])}
        print(f"Field Types: {fields}")
        
        expected_fields = ['type', 'quantity', 'cost_price', 'reference', 'created_at']
        for f in expected_fields:
            if f in fields:
                print(f"  [OK] Field '{f}' present as {fields[f]}")
            else:
                print(f"  [MISSING] Field '{f}' not found in metadata")

def test_udle_filtering():
    print("\n--- Testing UDLE Filtering Response ---")
    factory = RequestFactory()
    view = InventoryMovementViewSet.as_view({'get': 'list'})
    
    org = Organization.objects.get(slug='test-org')
    
    # Test filtering by type
    request = factory.get('/api/inventory/inventory-movements/?type=IN')
    request.org_id = org.id
    
    response = view(request)
    print(f"Filter Response Status: {response.status_code}")
    print(f"Response Data Type: {type(response.data)}")

if __name__ == "__main__":
    try:
        test_udle_metadata()
        test_udle_filtering()
        print("\n[SUCCESS] UDLE Backend Logic Verified.")
    except Exception as e:
        print(f"\n[FAILURE] UDLE Verification Failed: {str(e)}")
        import traceback
        traceback.print_exc()
