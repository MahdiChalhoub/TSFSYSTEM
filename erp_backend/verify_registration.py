import requests
import json
import uuid

BASE_URL = "http://127.0.0.1:8001/api"

def test_business_registration():
    print("Testing Business Registration...")
    unique_suffix = str(uuid.uuid4())[:8]
    data = {
        "business_name": f"Test Business {unique_suffix}",
        "business_slug": f"test-biz-{unique_suffix}",
        "admin_first_name": "Admin",
        "admin_last_name": "User",
        "admin_username": f"admin_{unique_suffix}",
        "admin_email": f"admin_{unique_suffix}@example.com",
        "admin_password": "password123",
        "phone": "+1234567890",
        "country": "US",
        "city": "New York",
        "address": "123 Tech Lane"
    }

    try:
        response = requests.post(f"{BASE_URL}/auth/register/business/", json=data)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 201:
            print("Successfully registered business!")
            print(json.dumps(response.json(), indent=2))
            return response.json()
        else:
            print(f"Registration failed: {response.text}")
            return None
    except Exception as e:
        print(f"Error during registration: {e}")
        return None

if __name__ == "__main__":
    result = test_business_registration()
    if result:
        print("\nVerification SUCCESS")
    else:
        print("\nVerification FAILED")
