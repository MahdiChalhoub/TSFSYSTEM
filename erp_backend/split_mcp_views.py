import ast

def split_file():
    with open("apps/mcp/views.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
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
    # The models imports are in header. We can reuse it mostly.

    groups = {
        'serializers.py': [
            'MCPProviderSerializer', 'MCPProviderCreateSerializer', 'MCPToolSerializer', 
            'MCPConnectionSerializer', 'MCPConversationSerializer', 'MCPMessageSerializer', 
            'MCPUsageLogSerializer', 'MCPAgentSerializer', 'MCPAgentLogSerializer'
        ],
        'permissions.py': [
            'CanViewMCP', 'CanManageMCP', 'CanUseMCPChat', 'CanExecuteMCPTools', 'IsMCPAdmin', 'CanManageAgents'
        ],
        'views_chat.py': ['MCPChatView', 'MCPToolExecuteView'],
        'views_admin.py': [
            'MCPProviderViewSet', 'MCPToolViewSet', 'MCPConversationViewSet', 
            'MCPUsageLogViewSet', 'MCPAgentViewSet', 'MCPAgentLogViewSet', 'MCPDashboardView'
        ]
    }
    
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

    # We need to write permissions and serializers separately
    # permissions doesn't need many imports, but let's just supply header
    with open("apps/mcp/permissions.py", "w", encoding="utf-8") as f:
        f.write("from rest_framework import permissions\nfrom erp.permissions import BaseModulePermission\n\n")
        f.write("\n\n".join(source_blocks['permissions.py']) + "\n")
        
    with open("apps/mcp/serializers.py", "w", encoding="utf-8") as f:
        f.write("from rest_framework import serializers\n")
        f.write("from .models import *\n\n")  # Just import all models to be safe
        f.write("\n\n".join(source_blocks['serializers.py']) + "\n")
        
    # For views_admin and views_chat, they need permissions and serializers
    views_header = header + "\nfrom .serializers import *\nfrom .permissions import *\n"
    
    for file_name in ['views_admin.py', 'views_chat.py']:
        with open(f"apps/mcp/{file_name}", "w", encoding="utf-8") as f:
            f.write(views_header + "\n\n" + "\n\n".join(source_blocks[file_name]) + "\n")
            
    # Main Service
    with open("apps/mcp/views.py", "w", encoding="utf-8") as f:
        f.write("# MCP VIEWS RE-EXPORTS\n")
        f.write("from .views_admin import *\n")
        f.write("from .views_chat import *\n")

if __name__ == "__main__":
    split_file()
