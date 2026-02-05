import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import RequestFactory
from django.urls import resolve
from erp.models import User, Organization
from erp.connector_engine import connector_engine

def debug_connector():
    try:
        u = User.objects.filter(is_superuser=True).first()
        org = Organization.objects.get(slug='saas')
        
        print(f"Using Superuser: {u.username}")
        print(f"Using Org: {org.name} (ID: {org.id})")
        
        # Test 1: Direct View Resolution
        path = '/api/pos/sales_today/'
        match = resolve(path)
        print(f"Resolved path {path} to: {match.func} (Action: {getattr(match.func, 'actions', 'N/A')})")
        
        factory = RequestFactory()
        request = factory.get(path)
        request.user = u
        request.org_id = org.id
        
        # Call the view
        response = match.func(request, *match.args, **match.kwargs)
        print(f"Response Status: {response.status_code}")
        print(f"Response Data: {getattr(response, 'data', 'NO DATA')}")
        
        # Test 2: Connector Engine
        print("\n--- Testing via ConnectorEngine ---")
        resp = connector_engine.route_read(target_module='pos', endpoint='sales_today', organization_id=org.id)
        print(f"Connector Response: {resp.to_dict()}")

    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_connector()
