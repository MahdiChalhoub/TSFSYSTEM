import ast

def split_file():
    with open("apps/inventory/views/product_views.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    # Identify imports
    import_lines = []
    class_node = None
    header_end = 0
    
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            pass
        elif isinstance(node, ast.ClassDef) and node.name == "ProductViewSet":
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
    throttle_class = ""
    
    for node in class_node.body:
        if isinstance(node, ast.FunctionDef):
            methods[node.name] = get_ast_node_source(node)
        elif isinstance(node, ast.ClassDef) and node.name == "StorefrontThrottle":
            throttle_class = get_ast_node_source(node)
        else:
            fields.append(get_ast_node_source(node))

    groups = {
        'product_bulk.py': {
            'mixin': 'ProductBulkMixin',
            'methods': ['bulk_move', 'bulk_update', 'generate_barcodes']
        },
        'product_analytics.py': {
            'mixin': 'ProductAnalyticsMixin',
            'methods': ['data_quality', 'search_enhanced', 'product_analytics', 'intelligence']
        },
        'product_combo.py': {
            'mixin': 'ProductComboMixin',
            'methods': ['create_complex', 'combo_components', 'add_combo_component', 'remove_combo_component']
        },
        'product_storefront.py': {
            'mixin': 'ProductStorefrontMixin',
            'methods': ['storefront']
        }
    }

    for name, group in groups.items():
        with open(f"apps/inventory/views/{name}", "w", encoding="utf-8") as f:
            f.write(header + "\n\n")
            
            # Need to include StorefrontThrottle in product_storefront along with the mixin
            if name == 'product_storefront.py':
                # Actually, the mixin also needs access or the class needs to be defined in it or the viewset. 
                # Let's write the mixin and put the throttle class inside the mixin or module.
                # Standard is inside module or inside class. Since it's inside ProductViewSet, we can leave it inside the viewset or move it.
                # Better leave it in the main viewset fields.
                pass
                
            f.write(f"class {group['mixin']}:\n")
            for m in group['methods']:
                if m in methods:
                    f.write(methods[m] + "\n\n")

    # Main Service
    with open("apps/inventory/views/product_views.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        f.write("from .product_bulk import ProductBulkMixin\n")
        f.write("from .product_analytics import ProductAnalyticsMixin\n")
        f.write("from .product_combo import ProductComboMixin\n")
        f.write("from .product_storefront import ProductStorefrontMixin\n\n")
        
        f.write("class ProductViewSet(ProductBulkMixin, ProductAnalyticsMixin, ProductComboMixin, ProductStorefrontMixin, UDLEViewSetMixin, TenantModelViewSet):\n")
        
        if throttle_class:
            f.write(throttle_class + "\n\n")
            
        for field in fields:
            if "UDLEViewSetMixin" not in field and "TenantModelViewSet" not in field:
                # The fields list contains simple assignments
                f.write(field + "\n")

if __name__ == "__main__":
    split_file()
