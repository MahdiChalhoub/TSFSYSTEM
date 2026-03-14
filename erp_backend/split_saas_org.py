import ast

def split_file():
    with open("erp/views_saas_org.py", "r", encoding="utf-8-sig") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    # Identify imports (top of file)
    import_lines = []
    class_node = None
    header_end = 0
    
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            pass
        elif isinstance(node, ast.ClassDef) and node.name == "OrgModuleViewSet":
            class_node = node
            header_end = node.lineno - 1
            break
            
    header = "\n".join(lines[:header_end])
    
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

    methods = {}
    fields = []
    
    for node in class_node.body:
        if isinstance(node, ast.FunctionDef):
            methods[node.name] = get_ast_node_source(node)
        else:
            fields.append(get_ast_node_source(node))

    groups = {
        'views_saas_org_modules.py': {
            'mixin': 'OrgSaasModulesMixin',
            'methods': ['business_types', 'modules', 'toggle_module', 'update_features']
        },
        'views_saas_org_billing.py': {
            'mixin': 'OrgSaasBillingMixin',
            'methods': ['usage', '_get_org_warnings', '_perform_plan_change', 'billing']
        },
        'views_saas_org_users.py': {
            'mixin': 'OrgSaasUsersMixin',
            'methods': ['users', 'create_user', 'reset_password', 'set_client']
        },
        'views_saas_org_sites.py': {
            'mixin': 'OrgSaasSitesMixin',
            'methods': ['sites', 'create_site', 'toggle_site']
        }
    }

    for name, group in groups.items():
        with open(f"erp/{name}", "w", encoding="utf-8") as f:
            f.write(header + "\n\n")
            f.write(f"class {group['mixin']}:\n")
            for m in group['methods']:
                if m in methods:
                    f.write(methods[m] + "\n\n")

    # Main Service
    with open("erp/views_saas_org.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        f.write("from .views_saas_org_modules import OrgSaasModulesMixin\n")
        f.write("from .views_saas_org_billing import OrgSaasBillingMixin\n")
        f.write("from .views_saas_org_users import OrgSaasUsersMixin\n")
        f.write("from .views_saas_org_sites import OrgSaasSitesMixin\n\n")
        
        f.write("class OrgModuleViewSet(OrgSaasModulesMixin, OrgSaasBillingMixin, OrgSaasUsersMixin, OrgSaasSitesMixin, viewsets.GenericViewSet):\n")
        for field in fields:
            f.write(field + "\n")

if __name__ == "__main__":
    split_file()
