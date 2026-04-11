import ast

def split_file():
    with open("apps/migration/mappers.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    import_lines = []
    class_nodes = []
    header_end = 0
    
    function_nodes = []
    
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            pass
        elif isinstance(node, ast.FunctionDef):
            function_nodes.append(node)
        elif isinstance(node, ast.ClassDef):
            if not class_nodes: # First class marks end of header
                header_end = node.lineno - 1
            class_nodes.append(node)
            
    header_lines = []
    # Capture everything before the first class/function
    first_non_import = None
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
            first_non_import = node
            break
            
    if first_non_import:
        header_end = first_non_import.lineno - 1
        header = "\n".join(lines[:header_end])
    else:
        header = ""
        
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

    utils = []
    for node in function_nodes:
        utils.append(get_ast_node_source(node))

    groups = {
        'mappers_inventory.py': ['UnitMapper', 'CategoryMapper', 'BrandMapper', 'ProductMapper'],
        'mappers_entities.py': ['ContactMapper', 'AccountMapper', 'SiteMapper'],
        'mappers_transactions.py': ['TransactionMapper', 'SellLineMapper', 'PurchaseLineMapper', 'ExpenseMapper', 'TransactionPaymentMapper']
    }
    
    # Let's add the utilities to all of them, or create a mappers_utils.py. Wait, easier to put utils in mappers_utils.py and import it
    with open("apps/migration/mappers_utils.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        f.write("\n\n".join(utils) + "\n")
        
    # The header is simple, just imports and logger
    
    source_blocks = {k: [] for k in groups}
    for node in class_nodes:
        for file_name, names in groups.items():
            if node.name in names:
                source_blocks[file_name].append(get_ast_node_source(node))
                break

    for file_name, blocks in source_blocks.items():
        with open(f"apps/migration/{file_name}", "w", encoding="utf-8") as f:
            f.write(header + "\n\n")
            f.write("from .mappers_utils import safe_decimal, safe_int, safe_str, safe_bool\n\n")
            f.write("\n\n".join(blocks) + "\n")
            
    with open("apps/migration/mappers.py", "w", encoding="utf-8") as f:
        f.write("# MAPPERS RE-EXPORTS\n")
        f.write("from .mappers_utils import *\n")
        f.write("from .mappers_inventory import *\n")
        f.write("from .mappers_entities import *\n")
        f.write("from .mappers_transactions import *\n")

if __name__ == "__main__":
    split_file()
