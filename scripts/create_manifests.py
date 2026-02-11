import os
import json

base_path = '/root/TSFSYSTEM/erp_backend/apps'
modules = {
    'crm': {
        "code": "crm",
        "name": "Customer Relationship",
        "version": "1.0.0",
        "description": "Lead tracking, contact management and customer engagement.",
        "dependencies": [],
        "required": False
    },
    'finance': {
        "code": "finance",
        "name": "Financial Management",
        "version": "1.0.5",
        "description": "General ledger, accounts payable/receivable, and financial reporting.",
        "dependencies": [],
        "required": False
    },
    'hr': {
        "code": "hr",
        "name": "Human Resources",
        "version": "1.0.0",
        "description": "Employee records, payroll, and performance management.",
        "dependencies": [],
        "required": False
    },
    'inventory': {
        "code": "inventory",
        "name": "Inventory Management",
        "version": "1.0.0",
        "description": "Real-time stock tracking, warehouse management and movements.",
        "dependencies": [],
        "required": False
    },
    'pos': {
        "code": "pos",
        "name": "Point of Sale",
        "version": "1.0.0",
        "description": "Fast checkout, thermal printing, and retail operations.",
        "dependencies": ["inventory"],
        "required": False
    }
}

for mod, manifest in modules.items():
    mod_path = os.path.join(base_path, mod)
    if os.path.exists(mod_path):
        manifest_path = os.path.join(mod_path, 'manifest.json')
        print(f"Creating manifest for {mod} at {manifest_path}")
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=4)
    else:
        print(f"Skip {mod}: Path not found")
