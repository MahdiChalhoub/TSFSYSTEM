import requests
import time
import random

BASE_URL = "http://127.0.0.1:8000/api"

def test_onboarding_flow():
    print("--- Starting Onboarding Flow Test ---")

    # 1. Test Config
    print("\n[1] Testing Public Config...")
    try:
        resp = requests.get(f"{BASE_URL}/auth/config/")
        if resp.status_code == 200:
            print("SUCCESS: Config retrieved.")
            config = resp.json()
            # print(config)
            business_types = config.get('business_types', [])
            currencies = config.get('currencies', [])
            if not business_types or not currencies:
                print("WARNING: Business types or currencies empty. Seeding might be needed.")
        else:
            print(f"FAILED: Config fetch {resp.status_code} - {resp.text}")
            return
    except Exception as e:
        print(f"FAILED: Connection error {e}")
        return

    # 2. Register Business
    print("\n[2] Testing Business Registration...")
    unique_id = int(time.time())
    
    # Use first available type/currency or defaults
    bt_id = business_types[0]['id'] if business_types else 1
    curr_id = currencies[0]['id'] if currencies else 1

    payload = {
        "business_name": f"Test Corp {unique_id}",
        "slug": f"test-corp-{unique_id}",
        "business_type_id": bt_id,
        "currency_id": curr_id,
        "email": f"corp_{unique_id}@example.com",
        "phone": "1234567890",
        "address": "123 Test St",
        "city": "Test City",
        "state": "Test State",
        "zip_code": "10000",
        "country": "Testland",
        "website": "https://example.com",
        "timezone": "UTC",
        
        # Admin
        "admin_first_name": "Test",
        "admin_last_name": "Admin",
        "admin_username": "shared_global_user", # Testing duplicate username support
        "admin_email": f"admin_{unique_id}@example.com",
        "admin_password": "Password123!"
    }

    # Multipart/form-data is required by the endpoint logic we saw in onboarding.ts
    # requests.post(..., data=payload) (without json=) sends form-data
    resp = requests.post(f"{BASE_URL}/auth/register/business/", data=payload)
    
    if resp.status_code == 201 or resp.status_code == 200:
        data = resp.json()
        print(f"SUCCESS: Business registered. Login URL: {data.get('login_url')}")
    else:
        print(f"FAILED: Business registration {resp.status_code} - {resp.text}")
        return

    # 3. Test Login (Token Access)
    print("\n[3] Testing Login with New Admin...")
    login_payload = {
        "username": f"admin_{unique_id}",
        "password": "Password123!"
    }
    # Usually standard simple_jwt is /api/token/ or /api/v1/auth/login/
    # Based on earlier contexts, it might be /auth/login/ which returns cookies or token
    # Let's try to find the login endpoint. commonly /api/v1/auth/login/ or /api/token/
    
    # Trying generic token endpoint first
    resp = requests.post(f"{BASE_URL}/auth/login/", json=login_payload)
    if resp.status_code != 200:
        # Try alternate path
        resp = requests.post(f"{BASE_URL}/token/", json=login_payload)
    
    if resp.status_code == 200:
        print("SUCCESS: Login successful.")
        token_data = resp.json()
        print(f"Token obtained: {str(token_data)[:50]}...")
        
        # Access Token for authorized requests
        access_token = token_data.get('access') or token_data.get('token') or token_data.get('key')
        
        # 4. Open Business (Get Dashboard/Organization Info)
        if access_token:
            print("\n[4] Testing Access to Business Data (Opening Business)...")
            headers = {"Authorization": f"Token {access_token}"}
            # Try to fetch organizations or current user info
            resp = requests.get(f"{BASE_URL}/auth/me/", headers=headers)
            if resp.status_code == 200:
                 print(f"SUCCESS: Retrieved user info: {resp.json().get('username')}")
                 # You might also want to check if the user is linked to the new organization
            else:
                 print(f"WARNING: Could not fetch /auth/me/ {resp.status_code}")
                 
            # Try fetching organizations
            resp = requests.get(f"{BASE_URL}/organizations/", headers=headers)
            if resp.status_code == 200:
                orgs = resp.json()
                results = orgs.get('results', []) if isinstance(orgs, dict) else orgs
                print(f"SUCCESS: Found {len(results)} organizations.")
                print(f"Organizations: {[o.get('name') for o in results]}")
            else:
                 print(f"WARNING: Could not fetch organizations {resp.status_code}")

    else:
        print(f"FAILED: Login {resp.status_code} - {resp.text}")

    print("\n--- Test Completed ---")

if __name__ == "__main__":
    test_onboarding_flow()
