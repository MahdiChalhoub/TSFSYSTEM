import requests
import json
import uuid

BASE_URL = "http://localhost:8000/api"

def test_approval_flow():
    # 1. Setup: We need a Manager (Admin) and a Pending User
    # Ideally reuse existing admin or create a new business for isolation
    # For simplicity, we'll try to use the 'DuplicateTest' admin if it exists or fail gracefully
    # BUT, to be robust, let's create a fresh business context
    
    unique_suffix = str(uuid.uuid4())[:8]
    slug = f"approval-test-{unique_suffix}"
    
    print(f"--- 1. Registering Business: {slug} ---")
    reg_payload = {
        "business_name": f"Approval Corp {unique_suffix}",
        "slug": slug,
        "business_type_id": 1, "currency_id": 1, 
        "email": f"contact@{slug}.com",
        "admin_first_name": "Boss", "admin_last_name": "Man",
        "admin_username": f"boss_{unique_suffix}",
        "admin_password": "password123",
        "admin_email": f"boss@{slug}.com"
    }
    
    res = requests.post(f"{BASE_URL}/auth/register/business/", json=reg_payload)
    if res.status_code != 201:
        print(f"Failed to register business: {res.text}")
        return
    print("Business Registered.")

    # 2. Login as Manager to get Token
    print(f"--- 2. Manager Login ---")
    auth_res = requests.post(f"{BASE_URL}/auth/login/", json={
        "username": f"boss_{unique_suffix}",
        "password": "password123"
    })
    if auth_res.status_code != 200:
        print(f"Failed to login: {auth_res.text}")
        return
    token = auth_res.json()['token']
    headers = {'Authorization': f'Token {token}'}
    # Simulate Host header? In local dev, backend resolves tenant via User-Org link usually, 
    # but some views might rely on middleware. 
    # PendingUsersView uses request.user.organization, so it's SAFE from Host header dependency.
    print("Manager Logged In.")

    # 3. Simulate a User Signup (Pending)
    # This endpoint needs tenant resolution. 
    # We can pass Host header OR relies on the fact that we are just hitting the API.
    # UserSignUpView uses get_current_tenant_id() which checks Host or Headers.
    # Let's see if we can trick it or if we need to pass X-Tenant-ID if implemented, or Host.
    # For localhost, we might need to map slug.localhost to 127.0.0.1 in hosts file 
    # OR we can just rely on the fact that if we use the same DB, we can manually create user via shell?
    # NO, we should test API.
    # Let's use a "dummy" generic signup if possible, or skip to creating user via shell for test speed.
    # Actually, UserSignUpView requires tenant context.
    # Let's skip the API-based signup for now and create the pending user via shell script logic or assuming it works.
    # OR, better: Manager can create users too? Not yet implemented.
    
    # WORKAROUND: We will assume the signup works (tested before) and manually create a pending user 
    # via a separate python shell command or just blindly trust the 'List Pending' will show empty first.
    
    # Let's just check 'List Pending' is empty
    print(f"--- 3. Check Pending List (Should be Empty) ---")
    list_res = requests.get(f"{BASE_URL}/manager/approvals/pending/", headers=headers)
    print(f"Pending List: {list_res.json()}")

    # 4. Create a Pending User via Shell (simulating signup)
    # We'll use a helper script for this part or just append to this script if we had Django access.
    # Since we are outside Django, we can only call APIs.
    # We will try to call signup with a Host header.
    print(f"--- 4. Registering Pending User (via API) ---")
    signup_headers = {"Host": f"{slug}.localhost:8000"} 
    # NOTE: Django `get_current_tenant_id` usually parses Host. 
    # If the middleware requires the Tenant to exist in DB (it does), and we just created it.
    
    signup_payload = {
        "username": f"employee_{unique_suffix}",
        "email": f"emp@{slug}.com",
        "password": "password123",
        "first_name": "John", "last_name": "Worker",
        "role_id": 1 # Likely 'Super Admin' is 1, but we need a 'Public' role. 
                     # Business Registration creates 'Super Admin'. 
                     # We might fail if no public roles exist.
                     # Default PublicConfigView logic?
    }
    
    # We can't easily guess Role ID without fetching Config.
    # Let's fetch config first using the Host header.
    config_res = requests.get(f"{BASE_URL}/auth/config/", headers=signup_headers)
    if config_res.status_code == 200:
        roles = config_res.json()['tenant'].get('roles', [])
        if roles:
            signup_payload['role_id'] = roles[0]['id']
            print(f"Found Public Role: {roles[0]['name']}")
        else:
            print("No public roles found. Cannot signup.")
            # Create a role? Manager can't create roles via API yet.
            # We'll stop here if no roles.
            return
            
    signup_res = requests.post(f"{BASE_URL}/auth/register/user/", json=signup_payload, headers=signup_headers)
    if signup_res.status_code != 201:
        print(f"User Signup Failed: {signup_res.text}")
        return
    print("User Signed Up (Pending).")

    # 5. Check Pending List Again
    print(f"--- 5. Check Pending List (Should have 1 user) ---")
    list_res2 = requests.get(f"{BASE_URL}/manager/approvals/pending/", headers=headers)
    pending_users = list_res2.json()
    print(f"Pending Users: {len(pending_users)}")
    
    if len(pending_users) > 0:
        user_id = pending_users[0]['id']
        print(f"Found Pending User ID: {user_id}")
        
        # 6. Approve
        print(f"--- 6. Approving User ---")
        approve_res = requests.post(f"{BASE_URL}/manager/approvals/{user_id}/approve/", headers=headers)
        if approve_res.status_code == 200:
            print("Approve Success!")
        else:
            print(f"Approve Failed: {approve_res.text}")

        # 7. Verify Empty List
        list_res3 = requests.get(f"{BASE_URL}/manager/approvals/pending/", headers=headers)
        print(f"Pending List after Approval: {len(list_res3.json())}")

if __name__ == "__main__":
    test_approval_flow()
