import requests
import json
import uuid

def test_duplicate_registration():
    url = "http://localhost:8000/api/auth/register/business/"
    
    # Use a fixed name/slug for this test to see collision handling
    # Note: frontend now allows manual slug, and backend uses that.
    # If the user provides "acme", backend checks "acme", if exists -> "acme-1"
    
    unique_suffix = str(uuid.uuid4())[:8]
    fixed_name = f"DuplicateTest_{unique_suffix}"
    fixed_slug = f"dup-test-{unique_suffix}"
    
    # Register First Time
    payload1 = {
        "business_name": fixed_name,
        "slug": fixed_slug,
        "business_type_id": 1, 
        "currency_id": 1,      
        "email": f"info@{fixed_slug}.com",
        "admin_first_name": "John",
        "admin_last_name": "Doe",
        "admin_username": f"admin_{unique_suffix}_1", # distinct username
        "admin_password": "password123",
        "admin_email": f"admin1@{fixed_slug}.com"
    }
    
    print(f"1. Registering: {fixed_name} (Slug: {fixed_slug})")
    res1 = requests.post(url, json=payload1)
    if res1.status_code == 201:
        print(f"   Success! Slug: {res1.json().get('slug')}")
    else:
        print(f"   Failed: {res1.text}")
        return

    # Register Second Time (Same Name & Slug)
    payload2 = payload1.copy()
    payload2['admin_username'] = f"admin_{unique_suffix}_2" # Must change username to avoid User constraint
    payload2['admin_email'] = f"admin2@{fixed_slug}.com"
    
    print(f"2. Registering AGAIN: {fixed_name} (Slug: {fixed_slug})")
    res2 = requests.post(url, json=payload2)
    if res2.status_code == 201:
        print(f"   Success! Slug: {res2.json().get('slug')}")
        if res2.json().get('slug') != fixed_slug:
             print("   -> System auto-generated a unique slug.")
    else:
        print(f"   Failed: {res2.text}")

if __name__ == "__main__":
    test_duplicate_registration()
