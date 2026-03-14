
import requests
import json

base_url = "http://localhost:8000/api/"
token = "YOUR_TOKEN_HERE" # I'll need to find a way to run this or use shell

def check_orders():
    headers = {
        "Authorization": f"Token {token}",
        "X-Scope": "OFFICIAL"
    }
    r1 = requests.get(base_url + "pos/orders/", headers=headers)
    o1 = r1.json()
    print(f"Official count: {len(o1)}")
    
    headers["X-Scope"] = "INTERNAL"
    r2 = requests.get(base_url + "pos/orders/", headers=headers)
    o2 = r2.json()
    print(f"Internal count: {len(o2)}")
    
if __name__ == "__main__":
    # This is a template, I'll run it via manage.py shell instead to avoid auth issues
    pass
