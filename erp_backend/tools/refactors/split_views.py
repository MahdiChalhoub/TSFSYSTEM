import ast

def split_file():
    with open("erp/views.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    # Identify imports (top of file)
    import_lines = []
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            start = node.lineno - 1
            end = node.end_lineno
            import_lines.append("\n".join(lines[start:end]))
            
    header = "\n".join(import_lines)
    header = "import logging\n" + header  # Ensure logging is imported if needed
    
    # We will just write a simpler AST-based splitter
    groups = {
        'views_base.py': ['TenantModelViewSet'],
        'views_users.py': ['UserViewSet', 'RoleViewSet', 'PermissionViewSet'],
        'views_org.py': ['OrganizationViewSet', 'SiteViewSet', 'CountryViewSet', 'CurrencyViewSet', 'BusinessTypeViewSet'],
        'views_dashboard.py': ['DashboardViewSet'],
        'views_system.py': ['NotificationViewSet', 'TenantResolutionView', 'SettingsViewSet', 'health_check', 'RecordHistoryViewSet', 'EntityGraphViewSet', 'import_sales_csv_view']
    }
    
    # Find bodies
    source_blocks = {k: [] for k in groups}
    
    for node in tree.body:
        name = getattr(node, 'name', None)
        if hasattr(node, 'decorator_list') and node.decorator_list:
            start_lineno = node.decorator_list[0].lineno - 1
        else:
            start_lineno = node.lineno - 1
            
        end_lineno = node.end_lineno
        
        node_src = "\n".join(lines[start_lineno:end_lineno])
        
        # We need to preserve preceding comments if possible.
        # Actually ast doesn't give comments. We'll capture any comments immediately above start_lineno
        comments = []
        c_idx = start_lineno - 1
        while c_idx >= 0 and (lines[c_idx].strip().startswith("#") or not lines[c_idx].strip()):
            comments.insert(0, lines[c_idx])
            c_idx -= 1
            # don't go too far back across blank lines
            if len(comments) > 1 and not comments[0].strip() and not comments[1].strip():
                comments.pop(0)

        full_node_src = "\n".join(comments) + "\n" + node_src
        
        if name:
            for file_name, names in groups.items():
                if name in names:
                    source_blocks[file_name].append(full_node_src)
                    break

    for file_name, blocks in source_blocks.items():
        with open(f"erp/{file_name}", "w", encoding="utf-8") as f:
            # We need to add the correct base imports to all of them, especially TenantModelViewSet to the others.
            custom_header = 'from .views_base import TenantModelViewSet\n' if file_name != 'views_base.py' else ''
            
            f.write(custom_header + "\n".join(import_lines) + "\n\n" + "\n\n".join(blocks) + "\n")
            
    # Finally, write the new erp/views.py which just exports them all
    with open("erp/views.py", "w", encoding="utf-8") as f:
        f.write("# KERNEL VIEWS RE-EXPORTS\n")
        f.write("from .views_base import *\n")
        f.write("from .views_users import *\n")
        f.write("from .views_org import *\n")
        f.write("from .views_dashboard import *\n")
        f.write("from .views_system import *\n")

if __name__ == "__main__":
    split_file()
