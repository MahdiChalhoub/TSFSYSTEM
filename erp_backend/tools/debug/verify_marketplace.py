import requests
import json
import time

BASE_URL = "http://localhost:8000/api/erp"
USER = "admin"
PASS = "admin"
TENANT_ID = "165c9434-85c3-4790-af4e-d0b1956c2f3c"

def test_marketplace():
    print(f"Logging in as {USER} for organization {TENANT_ID}...")
    headers = {"X-Tenant-Id": TENANT_ID}
    resp = requests.post(f"{BASE_URL}/auth/login/", json={"username": USER, "password": PASS}, headers=headers)
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    token = resp.json().get('token')
    headers["Authorization"] = f"Token {token}"
    print("Login successful.")

    print("\n--- Phase 1: Marketplace Module List ---")
    resp = requests.get(f"{BASE_URL}/marketplace/", headers=headers)
    if resp.status_code != 200:
        print(f"Marketplace list failed: {resp.text}")
        return
    data = resp.json()
    crm = next((m for m in data if m['code'] == 'crm'), None)
    hr = next((m for m in data if m['code'] == 'hr'), None)
    
    if crm:
        print(f"CRM Module: state={crm['state']}, plan_required={crm['plan_required']}, accessible={crm['plan_accessible']}")
    if hr:
        print(f"HR Module: state={hr['state']}, plan_required={hr['plan_required']}, accessible={hr['plan_accessible']}")

    print("\n--- Phase 2: Plan Lock Gate (CRM requires Business) ---")
    # TSF Global Demo has No Plan -> defaults to Starter
    resp = requests.post(f"{BASE_URL}/marketplace/crm/enable/", headers=headers)
    print(f"Enable CRM (Business) result: HTTP {resp.status_code}")
    if resp.status_code == 403:
        print("✅ Plan gate correctly blocked Business module on Starter org.")
    else:
        print(f"❌ Plan gate FAILED to block Business module. Status: {resp.status_code}")
        print(resp.text)

    print("\n--- Phase 3: Module Toggle (Finance/Inventory requires Starter) ---")
    # Find a starter module that is not enabled
    target = next((m for m in data if m['state'] == 'AVAILABLE' and m['plan_required'] == 'starter'), None)
    if not target:
        # If all are enabled, try to disable one first
        target = next((m for m in data if m['state'] == 'ENABLED' and not m['is_core']), None)
        if target:
            print(f"Disabling {target['code']} for testing...")
            requests.post(f"{BASE_URL}/marketplace/{target['code']}/disable/", headers=headers)
    
    if target:
        print(f"Enabling {target['code']} (Starter)...")
        resp = requests.post(f"{BASE_URL}/marketplace/{target['code']}/enable/", headers=headers)
        if resp.status_code == 200:
            print(f"✅ Module {target['code']} enabled successfully.")
        else:
            print(f"❌ Failed to enable {target['code']}: {resp.text}")

    print("\n--- Phase 4: Active Sidebar Dynamic Loading ---")
    resp = requests.get(f"{BASE_URL}/modules/active-sidebar/", headers=headers)
    if resp.status_code == 200:
        items = resp.json()
        codes = list(set([it.get('module_code') for it in items if it.get('module_code')]))
        print(f"Active Sidebar Modules: {codes}")
        if target and target['code'] in codes:
            print(f"✅ {target['code']} correctly appeared in the dynamic sidebar.")
        else:
            print(f"❌ {target['code']} missing from dynamic sidebar.")
    else:
        print(f"Sidebar fetch failed: {resp.text}")

if __name__ == "__main__":
    test_marketplace()
