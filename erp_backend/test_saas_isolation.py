import requests
import django
import os
import sys

# Setup Django Environment for model access
sys.path.append('c:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import User
from django.db import IntegrityError

BASE_URL = "http://127.0.0.1:8000/api"

def test_saas_isolation():
    print("--- Testing SaaS Panel Isolation ---")

    # 1. Create a SaaS Super Admin (Org=None, is_staff=True)
    username = "saas_commander"
    password = "MasterPassword123!"
    
    try:
        if not User.objects.filter(username=username, organization__isnull=True).exists():
            User.objects.create_superuser(
                username=username,
                email="commander@tsf.saas",
                password=password,
                organization=None # Explicitly None
            )
            print(f"SUCCESS: Created SaaS Superuser '{username}'")
        else:
            print(f"INFO: SaaS Superuser '{username}' already exists")
    except Exception as e:
        print(f"ERROR: Failed to create superuser: {e}")
        return

    # 2. Create a 'Lost' User (Org=None, is_staff=False) - Should be BLOCKED
    lost_username = "lost_soul"
    try:
        if not User.objects.filter(username=lost_username, organization__isnull=True).exists():
            User.objects.create_user(
                username=lost_username,
                email="lost@void.com",
                password=password,
                organization=None, # No Org
                is_staff=False # NOT Staff
            )
            print(f"SUCCESS: Created Non-Staff Root User '{lost_username}'")
    except Exception as e:
        print(f"ERROR: Failed to create lost user: {e}")

    # 3. Try to Login as SaaS Commander (Expect Success)
    print("\n[Test 1] Login as SaaS Commander (Root)...")
    headers = {} # No Tenant Header = Root
    resp = requests.post(f"{BASE_URL}/auth/login/", json={
        "username": username,
        "password": password
    }, headers=headers)
    
    if resp.status_code == 200:
        print("PASS: SaaS Commander logged in successfully.")
    else:
        print(f"FAIL: SaaS Commander blocked. {resp.status_code} - {resp.text}")

    # 4. Try to Login as Lost Soul (Expect Fail)
    print("\n[Test 2] Login as Non-Staff Root User...")
    resp = requests.post(f"{BASE_URL}/auth/login/", json={
        "username": lost_username,
        "password": password
    }, headers=headers)
    
    if resp.status_code == 400 and "Access Restricted" in resp.text:
        print("PASS: Non-Staff User correctly blocked from Root Panel.")
    else:
        print(f"FAIL: Non-Staff User NOT blocked correctly! {resp.status_code} - {resp.text}")

    print("\n--- Isolation Test Complete ---")

if __name__ == "__main__":
    test_saas_isolation()
