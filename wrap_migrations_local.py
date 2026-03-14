import os
import re

def wrap_migration(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'SeparateDatabaseAndState' in content:
        print(f"Skipping {filepath} - already wrapped.")
        return

    # Find operations list
    match = re.search(r'operations = \[(.*?)\]', content, re.DOTALL)
    if not match:
        print(f"Skipping {filepath} - operations list not found.")
        return
    
    ops_content = match.group(1)
    
    wrapped_ops = f"""
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[{ops_content}
            ],
            database_operations=[]
        )
    ]"""
    
    new_content = re.sub(r'operations = \[.*?\]', wrapped_ops, content, flags=re.DOTALL)
    
    with open(filepath, 'w') as f:
        f.write(new_content)
    print(f"Wrapped {filepath}")

files_to_fix = [
    'erp_backend/apps/crm/migrations/0022_remove_contact_idx_contact_org_type_and_more.py',
    'erp_backend/erp/migrations/0021_alter_approvalrule_organization_and_more.py',
    'erp_backend/apps/client_portal/migrations/0015_alter_cartpromotion_organization_and_more.py',
    'erp_backend/apps/inventory/migrations/0022_remove_product_unique_product_sku_per_org_and_more.py',
    'erp_backend/apps/hr/migrations/0004_alter_attendance_organization_and_more.py',
    'erp_backend/apps/integrations/migrations/0004_alter_webhookdeliverylog_organization_and_more.py',
    'erp_backend/apps/storage/migrations/0004_alter_storedfile_organization.py',
    'erp_backend/apps/workspace/migrations/0006_remove_autotaskrule_organization_and_more.py',
]

for f in files_to_fix:
    path = os.path.join('/root/.gemini/antigravity/scratch/TSFSYSTEM', f)
    if os.path.exists(path):
        wrap_migration(path)
    else:
        print(f"File not found: {path}")
