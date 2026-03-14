import ast

def split_file():
    with open("apps/mcp/services.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    # Locate where adapters start
    adapters_start = 0
    services_end = 0
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == "AIProviderAdapter":
            adapters_start = node.lineno - 1
            break
        services_end = node.end_lineno
            
    # However we might need to get the comments above AIProviderAdapter
    c_idx = adapters_start - 1
    comments = []
    while c_idx >= 0 and (lines[c_idx].strip().startswith("#") or not lines[c_idx].strip()):
        comments.insert(0, lines[c_idx])
        c_idx -= 1
        if len(comments) > 1 and not comments[0].strip() and not comments[1].strip():
            comments.pop(0)
            
    adapters_start_adjusted = adapters_start - len(comments)
    
    services_lines = lines[:adapters_start_adjusted]
    adapters_lines = lines[adapters_start_adjusted:]
    
    # We need to add the imports for adapters.py
    import_lines = []
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            start = node.lineno - 1
            end = node.end_lineno
            import_lines.append("\n".join(lines[start:end]))
            
    header = "\n".join(import_lines)
    
    # Make sure AIProviderAdapter logic handles all those classes. 
    # Actually, we can just dump the rest of the lines after adapters_start into adapters.py.
    
    with open("apps/mcp/adapters.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        # Ensure we have the necessary imports for models
        f.write("from .models import AIProvider\n\n")
        f.write("\n".join(adapters_lines) + "\n")
        
    with open("apps/mcp/services.py", "w", encoding="utf-8") as f:
        f.write("\n".join(services_lines) + "\n")
        f.write("\nfrom .adapters import AIProviderAdapter\n")

if __name__ == "__main__":
    split_file()
