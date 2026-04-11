import json
import os
import glob
from typing import Dict, List, Any

# ==============================================================================
# CONFIGURATION
# ==============================================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DATA_DIR = os.path.join(BASE_DIR, "..", "src", "data", "coa-templates")
BACKEND_TARGET_FILE = os.path.join(BASE_DIR, "erp", "coa_templates.py")

def flatten_accounts(accounts: List[Dict], parent_code: str = None) -> List[Dict]:
    """Flattens the hierarchical JSON structure into a flat list for the backend."""
    flat = []
    for acc in accounts:
        item = {
            "code": acc["code"],
            "name": acc["name"],
            "type": acc.get("type", "ASSET"),
        }
        if acc.get("subType"):
            item["sub_type"] = acc["subType"]
        
        if parent_code:
            item["parent_code"] = parent_code
            
        # Carry over any extra metadata
        for k, v in acc.items():
            if k not in ["code", "name", "type", "subType", "children"]:
                item[k] = v
                
        flat.append(item)
        if "children" in acc:
            flat.extend(flatten_accounts(acc["children"], acc["code"]))
    return flat

def sync():
    print("=" * 60)
    print("  COA Template Sync: JSON → Python")
    print("=" * 60)
    print(f"  Source: {FRONTEND_DATA_DIR}")
    print(f"  Target: {BACKEND_TARGET_FILE}")
    print()

    if not os.path.exists(FRONTEND_DATA_DIR):
        print(f"❌ Error: Source directory not found: {FRONTEND_DATA_DIR}")
        return

    json_files = glob.glob(os.path.join(FRONTEND_DATA_DIR, "*.json"))
    if not json_files:
        print("❌ Error: No JSON files found.")
        return

    templates_data = {}
    total_accounts = 0

    for file_path in json_files:
        filename = os.path.basename(file_path)
        key = filename.replace(".json", "")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            metadata = data.get("metadata", {})
            accounts_hierarchy = data.get("accounts", [])
            posting_rules = data.get("posting_rules", [])
            migration_hints = data.get("migration_hints", {})

            flat_accounts = flatten_accounts(accounts_hierarchy)
            total_accounts += len(flat_accounts)
            
            templates_data[key] = {
                "metadata": metadata,
                "accounts": flat_accounts,
                "posting_rules": posting_rules,
                "migration_hints": migration_hints
            }
            
            print(f"  ✅ {key}: {len(flat_accounts)} accounts, {len(posting_rules)} rules (from {filename})")
            
        except Exception as e:
            print(f"  ❌ Error processing {filename}: {str(e)}")

    # Generate the Python file
    python_content = [
        '"""',
        'Chart of Accounts Templates',
        '===========================',
        'AUTO-GENERATED from src/data/coa-templates/*.json',
        'Do NOT edit manually. Run: python tools/sync_coa_from_json.py',
        '',
        'Keys must match the frontend coa-templates index.ts exactly.',
        '"""',
        '',
        'TEMPLATES = {'
    ]

    for key, data in templates_data.items():
        python_content.append(f'    "{key}": {{')
        
        # Metadata - using repr for Python dictionary literal
        python_content.append(f'        "metadata": {repr(data["metadata"])},')
        
        # Accounts
        python_content.append('        "accounts": [')
        for i, acc in enumerate(data["accounts"]):
            comma = "," if i < len(data["accounts"]) - 1 else ""
            acc_repr = repr(acc)
            python_content.append(f'            {acc_repr}{comma}')
        python_content.append('        ],')
        
        # Posting Rules
        python_content.append('        "posting_rules": [')
        for i, rule in enumerate(data["posting_rules"]):
            comma = "," if i < len(data["posting_rules"]) - 1 else ""
            rule_repr = repr(rule)
            python_content.append(f'            {rule_repr}{comma}')
        python_content.append('        ],')

        # Migration Hints
        python_content.append(f'        "migration_hints": {repr(data["migration_hints"])}')
        
        python_content.append('    },')

    python_content.append('}')
    python_content.append('')

    with open(BACKEND_TARGET_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(python_content))

    print()
    print(f"  📊 Total accounts across all templates: {total_accounts}")
    print(f"  ✅ Written to {BACKEND_TARGET_FILE}")
    print(f"  📏 File size: {os.path.getsize(BACKEND_TARGET_FILE):,} bytes")
    print("=" * 60)

if __name__ == "__main__":
    sync()
