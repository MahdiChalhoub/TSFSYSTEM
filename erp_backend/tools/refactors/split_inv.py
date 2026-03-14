import ast

def split_file():
    with open("apps/inventory/views/inventory_views.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    # Identify imports (top of file)
    import_lines = []
    class_nodes = []
    
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            start = node.lineno - 1
            end = node.end_lineno
            import_lines.append("\n".join(lines[start:end]))
        elif isinstance(node, ast.ClassDef):
            class_nodes.append(node)
            
    header = "\n".join(import_lines)
    
    # Add the extra imports that are after some classes
    header += "\nfrom apps.inventory.models import StockAlert, StockAlertService\nfrom apps.inventory.serializers import StockAlertSerializer\n"

    # Grouping
    groups = {
        'views_core.py': ['InventoryViewSet', 'InventoryMovementViewSet'],
        'views_orders.py': ['StockAdjustmentOrderViewSet', 'StockTransferOrderViewSet', 'OperationalRequestViewSet'],
        'views_serial.py': ['ProductSerialViewSet', 'SerialLogViewSet'],
        'views_alerts.py': ['StockAlertViewSet']
    }
    
    source_blocks = {k: [] for k in groups}
    
    for node in class_nodes:
        start_lineno = node.lineno - 1
        if hasattr(node, "decorator_list") and node.decorator_list:
            start_lineno = node.decorator_list[0].lineno - 1
            
        end_lineno = node.end_lineno
        
        node_src = "\n".join(lines[start_lineno:end_lineno])
        
        c_idx = start_lineno - 1
        comments = []
        while c_idx >= 0 and (lines[c_idx].strip().startswith("#") or not lines[c_idx].strip()):
            comments.insert(0, lines[c_idx])
            c_idx -= 1
            if len(comments) > 1 and not comments[0].strip() and not comments[1].strip():
                comments.pop(0)

        full_node_src = "\n".join(comments) + "\n" + node_src
        
        name = node.name
        for file_name, names in groups.items():
            if name in names:
                source_blocks[file_name].append(full_node_src)
                break

    for file_name, blocks in source_blocks.items():
        with open(f"apps/inventory/views/{file_name}", "w", encoding="utf-8") as f:
            f.write(header + "\n\n" + "\n\n".join(blocks) + "\n")
            
    # Write the re-export to inventory_views.py
    with open("apps/inventory/views/inventory_views.py", "w", encoding="utf-8") as f:
        f.write("# INVENTORY VIEWS RE-EXPORTS\n")
        f.write("from .views_core import *\n")
        f.write("from .views_orders import *\n")
        f.write("from .views_serial import *\n")
        f.write("from .views_alerts import *\n")

if __name__ == "__main__":
    split_file()
