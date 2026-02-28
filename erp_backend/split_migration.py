import ast

def split_file():
    with open("apps/migration/views.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    # Identify imports (top of file)
    class_node = None
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == "MigrationViewSet":
            class_node = node
            break
            
    header_end = class_node.lineno - 1
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
        'views_setup.py': ['MigrationSetupMixin', ['upload', 'link', 'connect', 'businesses', 'preview', '_get_job_file_path']],
        'views_execution.py': ['MigrationExecutionMixin', ['start', 'resume', 'pipeline', 'logs', 'rollback']],
        'views_review.py': ['MigrationReviewMixin', ['samples', '_get_logic_snippet', 'review', 'account_mapping', '_bulk_edit', '_bulk_approve']]
    }
    
    for file_name, (mixin_name, method_names) in groups.items():
        with open(f"apps/migration/{file_name}", "w", encoding="utf-8") as f:
            f.write(header + "\n\n")
            f.write(f"class {mixin_name}:\n")
            for m in method_names:
                if m in methods:
                    method_src = methods[m]
                    f.write(method_src + "\n\n")

    # Main viewset
    with open("apps/migration/views.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        f.write("from .views_setup import MigrationSetupMixin\n")
        f.write("from .views_execution import MigrationExecutionMixin\n")
        f.write("from .views_review import MigrationReviewMixin\n\n")
        
        f.write("class MigrationViewSet(MigrationSetupMixin, MigrationExecutionMixin, MigrationReviewMixin, viewsets.ModelViewSet):\n")
        for f_source in fields:
            f.write(f_source + "\n")
            
        # Add get_queryset and get_serializer_class if they exist
        for m in ['get_queryset', 'get_serializer_class']:
            if m in methods:
                f.write(methods[m] + "\n\n")

if __name__ == "__main__":
    split_file()
