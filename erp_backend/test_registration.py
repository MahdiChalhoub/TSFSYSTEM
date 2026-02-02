import requests
import json
import uuid

def test_business_registration():
    url = "http://localhost:8000/api/auth/register/business/"
    
    unique_suffix = str(uuid.uuid4())[:8]
    safe_name = f"TestBiz{unique_suffix}"
    slug = f"testbiz-{unique_suffix}"
    
    payload = {
        "business_name": safe_name,
        "slug": slug,
        "business_type_id": 1, 
        "currency_id": 1,      
        "email": f"info@{safe_name}.com",
        "phone": "+1234567890",
        "timezone": "UTC",
        "admin_first_name": "John",
        "admin_last_name": "Founder",
        "admin_username": f"admin{unique_suffix}",
        "admin_password": "securepassword123",
        "admin_email": f"admin@{safe_name}.com"
    }
    
    print(f"Registering Business: {safe_name} (slug: {slug})...")
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 201:
            print("SUCCESS!")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"FAILED: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_business_registration()
