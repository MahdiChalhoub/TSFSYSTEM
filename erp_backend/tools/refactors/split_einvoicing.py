import ast

def split_file():
    with open("apps/finance/einvoicing_service.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    import_lines = []
    class_nodes = []
    
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom, ast.Assign)):
            # Include assignments (like constants at the top)
            start = node.lineno - 1
            end = node.end_lineno
            import_lines.append("\n".join(lines[start:end]))
        elif isinstance(node, ast.ClassDef):
            class_nodes.append(node)
            
    header = "\n".join(import_lines)
    header += "\n\nfrom apps.finance.models import ZATCAConfig, FNEConfig\n"
    
    for node in class_nodes:
        if node.name == "ZATCAService":
            zatca_node = node
        elif node.name == "FNEService":
            fne_node = node

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

    zatca_methods = {}
    zatca_fields = []
    for node in zatca_node.body:
        if isinstance(node, ast.FunctionDef):
            zatca_methods[node.name] = get_ast_node_source(node)
        else:
            zatca_fields.append(get_ast_node_source(node))

    groups = {
        'einvoicing_zatca_xml.py': {
            'mixin': 'ZATCAXMLMixin',
            'methods': ['generate_ubl_xml', '_get_type_code', '_add_supplier_party', '_add_customer_party', '_add_tax_total', '_add_monetary_total', '_add_invoice_lines']
        },
        'einvoicing_zatca_crypto.py': {
            'mixin': 'ZATCACryptoMixin',
            'methods': ['compute_invoice_hash', 'build_hash_chain', 'update_chain', 'sign_invoice', 'generate_qr_code', 'generate_qr_code_data']
        },
        'einvoicing_zatca_api.py': {
            'mixin': 'ZATCAApiMixin',
            'methods': ['submit_invoice', '_sandbox_submit', 'submit_for_clearance']
        },
        'einvoicing_zatca_core.py': {
            'mixin': 'ZATCACoreMixin',
            'methods': ['__init__', 'config', 'base_url']
        }
    }
    
    for name, group in groups.items():
        with open(f"apps/finance/{name}", "w", encoding="utf-8") as f:
            f.write(header + "\n\n")
            f.write(f"class {group['mixin']}:\n")
            for m in group['methods']:
                if m in zatca_methods:
                    f.write(zatca_methods[m] + "\n\n")
                    
    with open("apps/finance/einvoicing_fne.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        f.write(get_ast_node_source(fne_node) + "\n")
        
    with open("apps/finance/einvoicing_service.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        for group in groups.values():
            f.write(f"from .{list(groups.keys())[list(groups.values()).index(group)].replace('.py', '')} import {group['mixin']}\n")
        f.write("from .einvoicing_fne import FNEService\n\n")
        
        mixins = ", ".join([g['mixin'] for g in groups.values()])
        f.write(f"class ZATCAService({mixins}):\n")
        for f_source in zatca_fields:
            if not f_source.strip(): continue
            f.write(f_source + "\n")
        if not zatca_fields:
            f.write("    pass\n")

if __name__ == "__main__":
    split_file()
