import ast

def split_file():
    with open("apps/supplier_portal/views.py", "r", encoding="utf-8") as f:
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
    
    groups = {
        'views_auth.py': ['SupplierPortalLoginView'],
        'views_admin.py': ['SupplierPortalConfigViewSet', 'SupplierPortalAccessViewSet', 'SupplierProformaAdminViewSet', 'PriceChangeRequestAdminViewSet'],
        'views_supplier.py': [] # catch all
    }
    
    grouped_classes = set(groups['views_auth.py'] + groups['views_admin.py'])
    for node in class_nodes:
        if node.name not in grouped_classes:
            groups['views_supplier.py'].append(node.name)

    source_blocks = {k: [] for k in groups}
    
    def get_ast_node_source(node):
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

    for node in class_nodes:
        full_node_src = get_ast_node_source(node)
        name = node.name
        for file_name, names in groups.items():
            if name in names:
                source_blocks[file_name].append(full_node_src)
                break

    for file_name, blocks in source_blocks.items():
        with open(f"apps/supplier_portal/{file_name}", "w", encoding="utf-8") as f:
            f.write(header + "\n\n" + "\n\n".join(blocks) + "\n")
            
    # Write the re-export to views.py
    with open("apps/supplier_portal/views.py", "w", encoding="utf-8") as f:
        f.write("# SUPPLIER PORTAL VIEWS RE-EXPORTS\n")
        f.write("from .views_auth import *\n")
        f.write("from .views_admin import *\n")
        f.write("from .views_supplier import *\n")

if __name__ == "__main__":
    split_file()
