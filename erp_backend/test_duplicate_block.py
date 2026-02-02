import requests
import json
import uuid

def test_duplicate_blocking():
    url = "http://localhost:8000/api/auth/register/business/"
    
    unique_suffix = str(uuid.uuid4())[:8]
    fixed_name = f"UniqueBlockTest_{unique_suffix}"
    slug1 = f"block-test-1-{unique_suffix}"
    slug2 = f"block-test-2-{unique_suffix}"
    
    # 1. Register First Time
    payload1 = {
        "business_name": fixed_name,
        "slug": slug1,
        "business_type_id": 1, 
        "currency_id": 1,      
        "email": "test1@example.com",
        "admin_first_name": "A", "admin_last_name": "B",
        "admin_username": f"u1_{unique_suffix}",
        "admin_password": "p", "admin_email": f"a1_{unique_suffix}@e.com"
    }
    
    print(f"1. Registering: {fixed_name}")
    res1 = requests.post(url, json=payload1)
    if res1.status_code == 201:
        print("   Success!")
    else:
        print(f"   Failed (Unexpected): {res1.text}")
        return

    # 2. Register Second Time (Same Name, Different Everything Else)
    payload2 = payload1.copy()
    payload2['slug'] = slug2
    payload2['admin_username'] = f"u2_{unique_suffix}"
    payload2['admin_email'] = f"a2_{unique_suffix}@e.com"
    
    print(f"2. Registering DUPLICATE NAME: {fixed_name}")
    res2 = requests.post(url, json=payload2)
    
    if res2.status_code == 400:
        print("   Success: Blocked as expected.")
        print(f"   Response: {res2.text}")
    else:
        print(f"   FAILED: Should have blocked but got {res2.status_code}")
        print(res2.text)

if __name__ == "__main__":
    test_duplicate_blocking()
