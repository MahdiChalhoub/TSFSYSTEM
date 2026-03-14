import ast

with open("apps/migration/services.py", "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

tree = ast.parse("\n".join(lines))

header_end = 0
class_node = None
rollback_node = None
for node in tree.body:
    if isinstance(node, ast.ClassDef) and node.name == "MigrationService":
        class_node = node
        header_end = node.lineno - 1
    if isinstance(node, ast.ClassDef) and node.name == "MigrationRollbackService":
        rollback_node = node

header = lines[:header_end]

def get_ast_node_source(node, lines):
    start = node.lineno - 1
    if hasattr(node, "decorator_list") and node.decorator_list:
        start = node.decorator_list[0].lineno - 1
        
    c_idx = start - 1
    comments = []
    while c_idx >= 0 and (lines[c_idx].strip().startswith("#") or not lines[c_idx].strip()):
        comments.insert(0, lines[c_idx])
        c_idx -= 1
        if len(comments) > 1 and not comments[0].strip() and not comments[1].strip():
            comments.pop(0)
            
    node_body = lines[start:node.end_lineno]
    return "\n".join(comments) + "\n" + "\n".join(node_body)

methods = {}
fields = []
for node in class_node.body:
    if isinstance(node, ast.FunctionDef):
        methods[node.name] = get_ast_node_source(node, lines)
    else:
        fields.append(get_ast_node_source(node, lines))

# Organize methods into mixins
groups = {
    'services_base.py': {
        'mixin': 'MigrationBaseMixin',
        'methods': ['__init__', 'run', '_load_existing_mappings', '_heartbeat', '_parse_source', '_get_rows', '_log_error', '_get_or_create_mapping', '_save_mapping', '_migrate_finalize']
    },
    'services_entities.py': {
        'mixin': 'MigrationEntitiesMixin',
        'methods': ['_migrate_sites', '_migrate_taxes', '_migrate_units', '_migrate_categories', '_migrate_brands', '_migrate_users', '_migrate_contacts']
    },
    'services_inventory.py': {
        'mixin': 'MigrationInventoryMixin',
        'methods': ['_migrate_products', '_migrate_combo_links', '_migrate_inventory', '_migrate_stock_adjustments', '_migrate_stock_transfers']
    },
    'services_finance.py': {
        'mixin': 'MigrationFinanceMixin',
        'methods': ['_migrate_payments', '_migrate_accounts', '_migrate_expenses', '_migrate_account_transactions', '_migrate_currency_check']
    },
    'services_orders.py': {
        'mixin': 'MigrationOrdersMixin',
        'methods': ['_migrate_transactions', '_migrate_sell_lines', '_migrate_purchase_lines', '_bulk_save_lines']
    }
}

for name, group in groups.items():
    with open(f"apps/migration/{name}", "w", encoding="utf-8") as f:
        f.write("\n".join(header) + "\n\n")
        f.write(f"class {group['mixin']}:\n")
        for m in group['methods']:
            if m in methods:
                # Need to indent methods properly 
                # Actually get_ast_node_source captures the original indentation, which is 4 spaces inside the class.
                # Since we are putting it inside another class, the indentation stays correct!
                f.write(methods[m] + "\n\n")

# Main Service
with open("apps/migration/services.py", "w", encoding="utf-8") as f:
    f.write("\n".join(header) + "\n\n")
    for name, group in groups.items():
        base = name.replace(".py", "")
        f.write(f"from .{base} import {group['mixin']}\n")
    
    # Rollback Service is staying at the bottom or migrating?
    f.write("from .services_rollback import MigrationRollbackService\n\n")
    
    # Define main class
    mixins = ", ".join([g['mixin'] for g in groups.values()])
    f.write(f"class MigrationService({mixins}):\n")
    for field in fields:
        f.write(field + "\n")

# Rollback Service
if rollback_node:
    with open("apps/migration/services_rollback.py", "w", encoding="utf-8") as f:
        f.write("\n".join(header) + "\n\n")
        f.write(get_ast_node_source(rollback_node, lines) + "\n")

print("MigrationService split successfully!")
