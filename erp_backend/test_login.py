import requests
import json

url = "http://127.0.0.1:8000/api/auth/login/"
headers = {
    "Content-Type": "application/json",
    "X-Tenant-Id": "7179e0cb-54ee-4192-94f8-3ef06fffb423"
}
data = {
    "username": "admin_erp",
    "password": "hashed_password_123"
}

try:
    response = requests.post(url, headers=headers, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
