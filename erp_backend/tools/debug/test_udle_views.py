import os
import django
import sys
import uuid

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization, User, UDLESavedView

def test_saved_view_api():
    print("--- TESTING UDLE SAVED VIEW API ---")
    
    # 1. Ensure we have an Org and User for testing
    org = Organization.objects.first()
    if not org:
        print("No organization found. Creating one...")
        org = Organization.objects.create(name="Test Org", slug="test-org")
    
    user = User.objects.first()
    if not user:
         print("No user found. Creating one...")
         user = User.objects.create_user(username="testuser", password="password", organization=org)
    
    # 2. Test model logic
    view_name = f"Test View {uuid.uuid4().hex[:4]}"
    view = UDLESavedView.objects.create(
        user=user,
        organization=org,
        model_name="InventoryMovement",
        name=view_name,
        config={"columns": ["id", "type", "quantity"], "filters": {"type": "IN"}}
    )
    print(f"Successfully created SavedView: {view.name}")
    
    # 3. Verify defaults logic
    view2 = UDLESavedView.objects.create(
        user=user,
        organization=org,
        model_name="InventoryMovement",
        name="Default View",
        is_default=True,
        config={}
    )
    print(f"Created default view: {view2.name}")
    
    # 4. Cleanup
    UDLESavedView.objects.filter(name__in=[view_name, "Default View"]).delete()
    print("Done testing.")

if __name__ == "__main__":
    test_saved_view_api()
